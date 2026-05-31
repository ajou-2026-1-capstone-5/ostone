from __future__ import annotations

import json
import os
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import cast

import numpy as np

from pipeline.common.artifacts import ensure_stage_directory
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineConfigurationError, PipelineStageError
from pipeline.common.logging import get_stage_logger
from pipeline.stages.intent_discovery.feedback_constraints import FeedbackConstraint
from pipeline.stages.intent_discovery.io import read_preprocessed_artifact, write_clusters_artifact
from pipeline.stages.intent_discovery.semantic_validation import build_semantic_quality_report
from pipeline.stages.intent_discovery.types import ProcessedConversation
from pipeline.stages.preprocessing.io import read_stage_context
from pipeline.stages.representation.main import (
    EMBEDDING_INDEX_ARTIFACT,
    REPRESENTATION_REPORT_ARTIFACT,
    SEMANTIC_EMBEDDINGS_ARTIFACT,
    SEMANTIC_VARIANTS_ARTIFACT,
    representation_stage_dir,
)

MANIFEST_FILENAME = "manifest.json"
SUPPORTED_DISCOVERY_MODES = {"graph_leiden"}
ROOT_DOMAIN_PROFILE_ARTIFACT = "root_domain_profile.json"
SEMANTIC_QUALITY_REPORT_ARTIFACT = "semantic_quality_report.json"
VARIANT_OUTLIER_RATE_GATE = 0.25
VARIANT_CLUSTER_STABILITY_GATE = 0.70
VARIANT_CLUSTER_DISTINCTIVENESS_GATE = 0.45
VARIANT_POSITIVE_MARGIN_GATE = 0.65
MIN_CLUSTERING_SELECTION_SCORE_GAIN = 0.02
MAX_CLUSTERING_DISTINCTIVENESS_REGRESSION = 0.005


@dataclass(frozen=True)
class _ClusteringConfig:
    knn_k: int
    leiden_resolution: float
    min_cluster_size: int
    flow_affinity_weight: float
    min_affinity_similarity: float
    non_mutual_quantile: float
    hdbscan_min_samples: int | None
    compaction_enabled: bool
    compaction_thresholds: tuple[float, ...]
    min_compacted_clusters: int


@dataclass(frozen=True)
class _ClusteringCandidateResult:
    same_intent_threshold: float
    leiden_resolution: float
    memberships: list[int]
    outlier_node_indices: set[int]
    valid_clusters: dict[int, list[int]]
    hdbscan_summary: dict[str, object]
    hdbscan_refinement: dict[str, int]
    safe_merge_report: dict[str, object]
    outlier_reassignment_report: dict[str, object]
    same_intent_report: dict[str, object]
    selection_report: dict[str, object]


def run(upstream_manifest_path: str | None = None) -> dict[str, object]:
    runtime_config = PipelineRuntimeConfig.from_env()
    context = read_stage_context(upstream_manifest_path, stage_name="intent_discovery")
    logger = get_stage_logger(context)
    mode = _resolve_discovery_mode()

    logger.info("Starting intent discovery stage mode=%s", mode)
    return _run_graph_leiden(runtime_config, context)


def _resolve_discovery_mode() -> str:
    mode = os.getenv("PIPELINE_INTENT_DISCOVERY_MODE", "graph_leiden").strip().lower()
    if mode not in SUPPORTED_DISCOVERY_MODES:
        raise PipelineConfigurationError(f"Unsupported PIPELINE_INTENT_DISCOVERY_MODE: {mode}")
    return mode


def _run_graph_leiden(
    runtime_config: PipelineRuntimeConfig,
    context: StageContext,
) -> dict[str, object]:
    from pipeline.stages.intent_discovery.cluster_analysis import build_cluster_results
    from pipeline.stages.intent_discovery.clustering import (
        compact_clusters_by_centroid_similarity,
        compute_centroids,
        estimate_cluster_stability,
    )
    from pipeline.stages.intent_discovery.domain_profile import infer_root_domain_profile
    from pipeline.stages.intent_discovery.embedding import embed_texts
    from pipeline.stages.intent_discovery.evaluation import interpretability_score
    from pipeline.stages.intent_discovery.feedback_constraints import load_feedback_constraints_from_env
    from pipeline.stages.intent_discovery.types import (
        DEFAULT_KNN_K,
        DEFAULT_LEIDEN_RESOLUTION,
        DEFAULT_MIN_CLUSTER_SIZE,
        IntentDiscoveryStats,
    )

    logger = get_stage_logger(context)
    conversations, flow_signatures = read_preprocessed_artifact(runtime_config, context)
    logger.info("Loaded %d preprocessed conversations", len(conversations))
    root_domain_profile = infer_root_domain_profile(conversations)
    profile_path = _write_root_domain_profile(runtime_config, context, root_domain_profile)
    logger.info(
        "Root domain profile: root_domain=%s confidence=%.3f",
        root_domain_profile.root_domain,
        root_domain_profile.confidence,
    )

    texts = [conversation.canonical_text for conversation in conversations]
    embedding_candidates: dict[str, np.ndarray] = {}
    representation_variant_name: str | None = None
    representation_variant_report: dict[str, object] = {
        "enabled": False,
        "selectedVariant": None,
        "candidateCount": 0,
        "candidates": [],
    }
    representation = _load_representation_embeddings(runtime_config, context)
    if representation is None:
        embeddings, success_mask = embed_texts(texts, runtime_config=runtime_config)
        embedding_source = "intent_discovery_runtime"
        embedding_runtime = runtime_config.embedding_runtime
        embedding_model_name = runtime_config.embedding_model_name
    else:
        embeddings, success_mask, embedding_metadata, embedding_candidates = representation
        embedding_source = "representation"
        embedding_runtime = str(embedding_metadata.get("embeddingRuntime") or runtime_config.embedding_runtime)
        embedding_model_name = str(embedding_metadata.get("modelName") or runtime_config.embedding_model_name)
    logger.info("Embedded %d/%d texts", sum(success_mask), len(texts))

    success_indices = [index for index, ok in enumerate(success_mask) if ok]
    embedding_vectors = embeddings[success_indices]
    success_flow_signatures = flow_signatures[success_indices]
    success_conversations = [conversations[index] for index in success_indices]

    if embedding_vectors.shape[0] == 0:
        semantic_quality = build_semantic_quality_report(
            semantic_embeddings=embedding_vectors,
            valid_clusters={},
            embedding_runtime=embedding_runtime,
            embedding_model_name=embedding_model_name,
            embedding_source=embedding_source,
        )
        semantic_quality_path = _write_semantic_quality_report(runtime_config, context, semantic_quality)
        stats = IntentDiscoveryStats(
            input_count=len(conversations),
            embedding_failed_count=len(conversations),
            cluster_count=0,
            outlier_count=0,
            outlier_rate=0.0,
            avg_interpretability_score=0.0,
            avg_workflow_consistency_score=0.0,
        )
        clusters_path = write_clusters_artifact(
            runtime_config,
            context,
            [],
            [],
            stats,
            embedding_vectors,
            extra_manifest_payload={
                "root_domain_profile_path": profile_path.name,
                "semanticQualityReportPath": semantic_quality_path.name,
            },
            extra_output_payload={
                "semantic_quality": _semantic_quality_summary(semantic_quality),
                "semantic_quality_report_path": semantic_quality_path.name,
            },
        )
        logger.warning("No successful embeddings; wrote empty intent-discovery artifacts")
        return {"artifact_manifest_path": str((clusters_path.parent / MANIFEST_FILENAME).resolve())}

    knn_k = _resolve_positive_int_env("PIPELINE_KNN_K", DEFAULT_KNN_K)
    leiden_resolution = _resolve_positive_float_env("PIPELINE_LEIDEN_RESOLUTION", DEFAULT_LEIDEN_RESOLUTION)
    min_cluster_size = _resolve_positive_int_env("PIPELINE_MIN_CLUSTER_SIZE", DEFAULT_MIN_CLUSTER_SIZE)
    flow_affinity_weight = _resolve_bounded_float_env("PIPELINE_FLOW_AFFINITY_WEIGHT", 0.08, low=0.0, high=1.0)
    min_affinity_similarity = _resolve_bounded_float_env("PIPELINE_AFFINITY_MIN_SIMILARITY", 0.05, low=0.0, high=1.0)
    non_mutual_quantile = _resolve_bounded_float_env(
        "PIPELINE_AFFINITY_NON_MUTUAL_QUANTILE",
        0.90,
        low=0.0,
        high=1.0,
    )
    hdbscan_min_samples = _resolve_optional_positive_int_env("PIPELINE_HDBSCAN_MIN_SAMPLES")
    compaction_enabled = _resolve_bool_env("PIPELINE_CLUSTER_COMPACTION_ENABLED", default=True)
    compaction_thresholds = _resolve_float_sequence_env(
        "PIPELINE_CLUSTER_COMPACTION_THRESHOLDS",
        default=(0.84, 0.85, 0.86, 0.87, 0.88, 0.89, 0.90, 0.91, 0.92, 0.93, 0.94, 0.95),
        low=0.0,
        high=1.0,
    )
    min_compacted_clusters = _resolve_positive_int_env("PIPELINE_MIN_COMPACTED_CLUSTERS", 4)
    same_intent_threshold = _resolve_bounded_float_env(
        "PIPELINE_SAME_INTENT_THRESHOLD",
        0.65,
        low=0.0,
        high=1.0,
    )
    clustering_selection_enabled = _resolve_bool_env("PIPELINE_CLUSTERING_CONFIG_SELECTION_ENABLED", default=True)
    same_intent_threshold_candidates = _resolve_float_sequence_env(
        "PIPELINE_SAME_INTENT_THRESHOLD_CANDIDATES",
        default=_candidate_float_values(
            same_intent_threshold,
            offsets=(0.0, 0.06, 0.12),
            low=0.45,
            high=0.78,
        ),
        low=0.0,
        high=1.0,
    )
    leiden_resolution_candidates = _resolve_float_sequence_env(
        "PIPELINE_LEIDEN_RESOLUTION_CANDIDATES",
        default=_candidate_float_values(
            leiden_resolution,
            offsets=(0.0, 0.35),
            low=0.6,
            high=3.0,
        ),
        low=0.1,
        high=5.0,
    )
    safe_merge_enabled = _resolve_bool_env("PIPELINE_SAFE_MERGE_ENABLED", default=True)
    safe_merge_min_score = _resolve_bounded_float_env("PIPELINE_SAFE_MERGE_MIN_SCORE", 0.75, low=0.0, high=1.0)
    clustering_config = _ClusteringConfig(
        knn_k=knn_k,
        leiden_resolution=leiden_resolution,
        min_cluster_size=min_cluster_size,
        flow_affinity_weight=flow_affinity_weight,
        min_affinity_similarity=min_affinity_similarity,
        non_mutual_quantile=non_mutual_quantile,
        hdbscan_min_samples=hdbscan_min_samples,
        compaction_enabled=compaction_enabled,
        compaction_thresholds=compaction_thresholds,
        min_compacted_clusters=min_compacted_clusters,
    )

    if embedding_candidates and _resolve_bool_env("PIPELINE_REPRESENTATION_VARIANT_SELECTION_ENABLED", default=True):
        embeddings, representation_variant_name, representation_variant_report = _select_representation_variant(
            candidates=embedding_candidates,
            success_indices=success_indices,
            success_conversations=success_conversations,
            flow_signatures=success_flow_signatures,
            embedding_runtime=embedding_runtime,
            embedding_model_name=embedding_model_name,
            clustering_config=clustering_config,
            same_intent_threshold=same_intent_threshold,
        )
        embedding_vectors = embeddings[success_indices]
        embedding_source = f"representation:{representation_variant_name}"
        logger.info(
            "Selected representation variant=%s score=%.3f",
            representation_variant_name,
            _safe_float(representation_variant_report.get("selectedScore")),
        )
    elif embedding_candidates:
        representation_variant_name = "role_weighted"
        representation_variant_report = {
            "enabled": False,
            "selectedVariant": representation_variant_name,
            "candidateCount": len(embedding_candidates),
            "candidates": [],
        }

    vectors = embedding_vectors.astype(np.float32, copy=False)
    logger.info("Built semantic vectors shape=%s", list(vectors.shape))

    feedback_constraints = load_feedback_constraints_from_env()
    selected_clustering = _select_clustering_candidate(
        vectors=vectors,
        success_conversations=success_conversations,
        flow_signatures=success_flow_signatures,
        embedding_runtime=embedding_runtime,
        embedding_model_name=embedding_model_name,
        embedding_source=embedding_source,
        clustering_config=clustering_config,
        threshold_candidates=same_intent_threshold_candidates
        if clustering_selection_enabled
        else (same_intent_threshold,),
        resolution_candidates=leiden_resolution_candidates if clustering_selection_enabled else (leiden_resolution,),
        feedback_constraints=feedback_constraints,
        safe_merge_enabled=safe_merge_enabled,
        safe_merge_min_score=safe_merge_min_score,
    )
    same_intent_threshold = selected_clustering.same_intent_threshold
    leiden_resolution = selected_clustering.leiden_resolution
    memberships = selected_clustering.memberships
    outlier_node_indices = selected_clustering.outlier_node_indices
    valid_clusters = selected_clustering.valid_clusters
    hdbscan_summary = selected_clustering.hdbscan_summary
    hdbscan_refinement = selected_clustering.hdbscan_refinement
    safe_merge_report = selected_clustering.safe_merge_report
    outlier_reassignment_report = selected_clustering.outlier_reassignment_report
    same_intent_report = selected_clustering.same_intent_report
    clustering_selection_report = selected_clustering.selection_report
    logger.info(
        "same-intent probability graph: threshold=%.3f resolution=%.3f "
        "edges=%s candidates=%s ambiguous=%s constraints=%d",
        same_intent_threshold,
        leiden_resolution,
        same_intent_report.get("edgeCount"),
        same_intent_report.get("candidatePairCount"),
        same_intent_report.get("ambiguousPairCount"),
        len(feedback_constraints),
    )
    logger.info("Leiden detected %d communities", len(set(memberships)))
    logger.info("Outlier count: %d, valid clusters: %d", len(outlier_node_indices), len(valid_clusters))
    typed_hdbscan_labels = hdbscan_summary.get("hdbscanLabels")
    typed_hdbscan_labels = typed_hdbscan_labels if isinstance(typed_hdbscan_labels, list) else []
    logger.info(
        "HDBSCAN refinement: split_clusters=%d refined_clusters=%d noise_members=%d",
        hdbscan_refinement["hdbscanSplitClusterCount"],
        hdbscan_refinement["hdbscanRefinedClusterCount"],
        hdbscan_refinement["hdbscanNoiseMemberCount"],
    )
    logger.info(
        "Safe merge: input=%s output=%s blocked_conflicts=%s",
        safe_merge_report.get("safeMergeInputClusterCount"),
        safe_merge_report.get("safeMergeOutputClusterCount"),
        safe_merge_report.get("safeMergeBlockedConflictCount"),
    )
    logger.info(
        "Outlier reassignment: input=%s reassigned=%s remaining=%d",
        outlier_reassignment_report.get("outlierReassignmentInputCount"),
        outlier_reassignment_report.get("outlierReassignmentCount"),
        len(outlier_node_indices),
    )

    pre_compaction_quality = build_semantic_quality_report(
        semantic_embeddings=embedding_vectors,
        valid_clusters=valid_clusters,
        embedding_runtime=embedding_runtime,
        embedding_model_name=embedding_model_name,
        embedding_source=embedding_source,
    )
    compaction_report = {
        "clusterCompactionEnabled": False,
        "clusterCompactionSelected": False,
        "clusterCompactionReason": "disabled",
    }
    if compaction_enabled:
        effective_min_compacted_clusters = min(
            len(valid_clusters),
            min_compacted_clusters,
        )
        valid_clusters, compaction_report = _select_margin_compaction(
            valid_clusters=valid_clusters,
            semantic_vectors=vectors,
            semantic_embeddings=embedding_vectors,
            embedding_runtime=embedding_runtime,
            embedding_model_name=embedding_model_name,
            embedding_source=embedding_source,
            thresholds=compaction_thresholds,
            min_compacted_clusters=effective_min_compacted_clusters,
            hdbscan_labels=typed_hdbscan_labels,
            compact_fn=compact_clusters_by_centroid_similarity,
        )
        logger.info(
            "Cluster compaction selected=%s input=%s output=%s threshold=%s distinctiveness %.3f -> %.3f",
            compaction_report.get("clusterCompactionSelected"),
            compaction_report.get("clusterCompactionInputClusterCount"),
            compaction_report.get("clusterCompactionOutputClusterCount"),
            compaction_report.get("clusterCompactionThreshold"),
            _safe_float(compaction_report.get("clusterCompactionBeforeDistinctiveness")),
            _safe_float(compaction_report.get("clusterCompactionAfterDistinctiveness")),
        )

    centroids = compute_centroids(vectors, valid_clusters)
    stability = estimate_cluster_stability(vectors, success_flow_signatures, valid_clusters)
    semantic_quality = build_semantic_quality_report(
        semantic_embeddings=embedding_vectors,
        valid_clusters=valid_clusters,
        embedding_runtime=embedding_runtime,
        embedding_model_name=embedding_model_name,
        embedding_source=embedding_source,
    )
    semantic_quality.update(
        {
            "clusterStability": stability["clusterStability"],
            "clusterStabilityRunCount": stability["clusterStabilityRunCount"],
            "hdbscanAvailable": hdbscan_summary["hdbscanAvailable"],
            "hdbscanNoiseRate": hdbscan_summary["hdbscanNoiseRate"],
            "hdbscanSplitCandidateCount": hdbscan_summary["hdbscanSplitCandidateCount"],
            "hdbscanFlowWeight": hdbscan_summary.get("hdbscanFlowWeight"),
            **hdbscan_refinement,
            **safe_merge_report,
            **outlier_reassignment_report,
            "sameIntentGraph": same_intent_report,
            "feedbackConstraintCount": len(feedback_constraints),
            "representationVariantName": representation_variant_name,
            "representationVariantSelection": representation_variant_report,
            "clusteringConfigSelection": clustering_selection_report,
            "clusterCompactionBeforeDistinctiveness": pre_compaction_quality.get("clusterDistinctiveness"),
            "clusterCompactionBeforePositiveMarginRate": pre_compaction_quality.get("positiveMarginRate"),
            "clusterCompactionBeforeSeparationMargin": pre_compaction_quality.get("meanSeparationMargin"),
            **compaction_report,
        }
    )
    semantic_quality_path = _write_semantic_quality_report(runtime_config, context, semantic_quality)
    cluster_results, novel_candidates = build_cluster_results(
        valid_clusters,
        outlier_node_indices,
        success_conversations,
        vectors,
        centroids,
        root_domain_profile=root_domain_profile,
    )
    logger.info("Built %d cluster results, %d novel candidates", len(cluster_results), len(novel_candidates))

    interp_score = interpretability_score(vectors, memberships, centroids)
    avg_workflow = (
        sum(result.quality.workflow_consistency_score for result in cluster_results) / len(cluster_results)
        if cluster_results
        else 0.0
    )
    logger.info("Interpretability=%.3f, workflow_consistency=%.3f", interp_score, avg_workflow)

    embedding_failed = sum(1 for ok in success_mask if not ok)
    outlier_count = len(outlier_node_indices)
    stats = IntentDiscoveryStats(
        input_count=len(conversations),
        embedding_failed_count=embedding_failed,
        cluster_count=len(cluster_results),
        outlier_count=outlier_count,
        outlier_rate=outlier_count / len(success_conversations) if success_conversations else 0.0,
        avg_interpretability_score=interp_score,
        avg_workflow_consistency_score=avg_workflow,
    )

    clusters_path = write_clusters_artifact(
        runtime_config,
        context,
        cluster_results,
        novel_candidates,
        stats,
        embeddings,
        extra_manifest_payload={
            "root_domain_profile_path": profile_path.name,
            "semanticQualityReportPath": semantic_quality_path.name,
            "clusteringConfig": {
                "kNeighbors": knn_k,
                "leidenResolution": leiden_resolution,
                "minClusterSize": min_cluster_size,
                "flowAffinityWeight": flow_affinity_weight,
                "minAffinitySimilarity": min_affinity_similarity,
                "nonMutualKeepQuantile": non_mutual_quantile,
                "hdbscanMinSamples": hdbscan_min_samples,
                "clusterCompactionEnabled": compaction_report.get("clusterCompactionEnabled"),
                "clusterCompactionThreshold": compaction_report.get("clusterCompactionThreshold"),
                "representationVariantSelectionEnabled": representation_variant_report.get("enabled"),
                "representationVariantName": representation_variant_name,
                "clusteringConfigSelectionEnabled": clustering_selection_report.get("enabled"),
                "clusteringConfigSelectedScore": clustering_selection_report.get("selectedScore"),
                "sameIntentThreshold": same_intent_threshold,
                "safeMergeEnabled": safe_merge_enabled,
                "safeMergeMinScore": safe_merge_min_score,
                "feedbackConstraintCount": len(feedback_constraints),
            },
        },
        extra_output_payload={
            "semantic_quality": _semantic_quality_summary(semantic_quality),
            "semantic_quality_report_path": semantic_quality_path.name,
            "clustering_config": {
                "kNeighbors": knn_k,
                "leidenResolution": leiden_resolution,
                "minClusterSize": min_cluster_size,
                "flowAffinityWeight": flow_affinity_weight,
                "minAffinitySimilarity": min_affinity_similarity,
                "nonMutualKeepQuantile": non_mutual_quantile,
                "hdbscanMinSamples": hdbscan_min_samples,
                "clusterCompactionEnabled": compaction_report.get("clusterCompactionEnabled"),
                "clusterCompactionThreshold": compaction_report.get("clusterCompactionThreshold"),
                "clusteringConfigSelectionEnabled": clustering_selection_report.get("enabled"),
                "clusteringConfigSelectedScore": clustering_selection_report.get("selectedScore"),
                "sameIntentThreshold": same_intent_threshold,
            },
            "hdbscan_assist": {key: value for key, value in hdbscan_summary.items() if key != "hdbscanLabels"},
            "hdbscan_refinement": hdbscan_refinement,
            "same_intent_graph": same_intent_report,
            "safe_merge": safe_merge_report,
            "outlier_reassignment": outlier_reassignment_report,
            "cluster_compaction": compaction_report,
            "representation_variant_selection": representation_variant_report,
        },
    )
    logger.info("Intent discovery graph Leiden stage completed: %s", stats)
    return {"artifact_manifest_path": str((clusters_path.parent / MANIFEST_FILENAME).resolve())}


def _write_root_domain_profile(
    runtime_config: PipelineRuntimeConfig,
    context: StageContext,
    root_domain_profile: object,
) -> Path:
    output_dir = ensure_stage_directory(context, runtime_config)
    profile_path = output_dir / ROOT_DOMAIN_PROFILE_ARTIFACT
    to_dict = getattr(root_domain_profile, "to_dict", None)
    payload = to_dict() if callable(to_dict) else {}
    profile_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return profile_path


def _resolve_positive_int_env(key: str, default: int) -> int:
    value = os.getenv(key, "").strip()
    if not value:
        return default
    try:
        parsed = int(value)
    except ValueError:
        return default
    return parsed if parsed > 0 else default


def _resolve_optional_positive_int_env(key: str) -> int | None:
    value = os.getenv(key, "").strip()
    if not value:
        return None
    try:
        parsed = int(value)
    except ValueError:
        return None
    return parsed if parsed > 0 else None


def _resolve_positive_float_env(key: str, default: float) -> float:
    value = os.getenv(key, "").strip()
    if not value:
        return default
    try:
        parsed = float(value)
    except ValueError:
        return default
    return parsed if parsed > 0.0 else default


def _resolve_bounded_float_env(key: str, default: float, *, low: float, high: float) -> float:
    value = os.getenv(key, "").strip()
    if not value:
        return default
    try:
        parsed = float(value)
    except ValueError:
        return default
    return parsed if low <= parsed <= high else default


def _resolve_bool_env(key: str, *, default: bool) -> bool:
    value = os.getenv(key, "").strip().lower()
    if not value:
        return default
    if value in {"1", "true", "yes", "y", "on"}:
        return True
    if value in {"0", "false", "no", "n", "off"}:
        return False
    return default


def _resolve_float_sequence_env(
    key: str,
    *,
    default: tuple[float, ...],
    low: float,
    high: float,
) -> tuple[float, ...]:
    value = os.getenv(key, "").strip()
    if not value:
        return default
    parsed_values: list[float] = []
    for raw_part in value.split(","):
        part = raw_part.strip()
        if not part:
            continue
        try:
            parsed = float(part)
        except ValueError:
            continue
        if low <= parsed <= high:
            parsed_values.append(parsed)
    return tuple(parsed_values) if parsed_values else default


def _candidate_float_values(
    base: float,
    *,
    offsets: Sequence[float],
    low: float,
    high: float,
) -> tuple[float, ...]:
    values: list[float] = []
    seen: set[float] = set()
    for offset in offsets:
        value = round(max(low, min(high, base + offset)), 6)
        if value in seen:
            continue
        values.append(value)
        seen.add(value)
    return tuple(values)


def _select_representation_variant(
    *,
    candidates: dict[str, np.ndarray],
    success_indices: list[int],
    success_conversations: list[ProcessedConversation],
    flow_signatures: np.ndarray,
    embedding_runtime: str,
    embedding_model_name: str,
    clustering_config: _ClusteringConfig,
    same_intent_threshold: float,
) -> tuple[np.ndarray, str, dict[str, object]]:
    if not candidates:
        raise PipelineStageError("Representation variant selection requires at least one embedding candidate.")

    selected_name = _ordered_variant_names(candidates)[0]
    selected_score = float("-inf")
    candidate_reports: list[dict[str, object]] = []
    for variant_name in _ordered_variant_names(candidates):
        variant_embeddings = candidates[variant_name]
        variant_vectors = variant_embeddings[success_indices].astype(np.float32, copy=False)
        report = _score_representation_variant(
            variant_name=variant_name,
            variant_vectors=variant_vectors,
            success_conversations=success_conversations,
            flow_signatures=flow_signatures,
            embedding_runtime=embedding_runtime,
            embedding_model_name=embedding_model_name,
            clustering_config=clustering_config,
            same_intent_threshold=same_intent_threshold,
        )
        candidate_reports.append(report)
        score = _safe_float(report.get("score"))
        if score > selected_score:
            selected_score = score
            selected_name = variant_name

    return (
        candidates[selected_name],
        selected_name,
        {
            "enabled": True,
            "selectedVariant": selected_name,
            "selectedScore": selected_score,
            "candidateCount": len(candidate_reports),
            "candidates": candidate_reports,
        },
    )


def _score_representation_variant(
    *,
    variant_name: str,
    variant_vectors: np.ndarray,
    success_conversations: list[ProcessedConversation],
    flow_signatures: np.ndarray,
    embedding_runtime: str,
    embedding_model_name: str,
    clustering_config: _ClusteringConfig,
    same_intent_threshold: float,
) -> dict[str, object]:
    from pipeline.stages.intent_discovery.clustering import (
        compact_clusters_by_centroid_similarity,
        detect_communities,
        estimate_cluster_stability,
        hdbscan_assist_summary,
        identify_outliers,
        refine_clusters_with_hdbscan,
    )
    from pipeline.stages.intent_discovery.same_intent_graph import build_same_intent_probability_graph

    if variant_vectors.shape[0] == 0:
        return {
            "variant": variant_name,
            "score": 0.0,
            "clusterCount": 0,
            "outlierRate": 0.0,
        }

    graph, same_intent_report = build_same_intent_probability_graph(
        success_conversations,
        variant_vectors,
        flow_signatures,
        k=clustering_config.knn_k,
        base_threshold=same_intent_threshold,
    )
    memberships = detect_communities(graph, resolution=clustering_config.leiden_resolution)
    outliers, valid_clusters = identify_outliers(memberships, min_size=clustering_config.min_cluster_size)
    hdbscan_summary = hdbscan_assist_summary(
        variant_vectors,
        valid_clusters,
        min_cluster_size=clustering_config.min_cluster_size,
        flow_signatures=flow_signatures,
        flow_weight=clustering_config.flow_affinity_weight,
        min_samples=clustering_config.hdbscan_min_samples,
    )
    hdbscan_labels = hdbscan_summary.get("hdbscanLabels")
    typed_hdbscan_labels = hdbscan_labels if isinstance(hdbscan_labels, list) else []
    outliers, valid_clusters, hdbscan_refinement = refine_clusters_with_hdbscan(
        valid_clusters,
        outliers,
        typed_hdbscan_labels,
        min_size=clustering_config.min_cluster_size,
    )
    compaction_report: dict[str, object] = {
        "clusterCompactionEnabled": False,
        "clusterCompactionSelected": False,
        "clusterCompactionReason": "disabled",
    }
    if clustering_config.compaction_enabled:
        valid_clusters, compaction_report = _select_margin_compaction(
            valid_clusters=valid_clusters,
            semantic_vectors=variant_vectors,
            semantic_embeddings=variant_vectors,
            embedding_runtime=embedding_runtime,
            embedding_model_name=embedding_model_name,
            embedding_source=f"representation:{variant_name}",
            thresholds=clustering_config.compaction_thresholds,
            min_compacted_clusters=min(len(valid_clusters), clustering_config.min_compacted_clusters),
            hdbscan_labels=typed_hdbscan_labels,
            compact_fn=compact_clusters_by_centroid_similarity,
        )
    quality = build_semantic_quality_report(
        semantic_embeddings=variant_vectors,
        valid_clusters=valid_clusters,
        embedding_runtime=embedding_runtime,
        embedding_model_name=embedding_model_name,
        embedding_source=f"representation:{variant_name}",
    )
    stability = estimate_cluster_stability(variant_vectors, flow_signatures, valid_clusters)
    outlier_rate = len(outliers) / variant_vectors.shape[0] if variant_vectors.shape[0] else 0.0
    score = _semantic_variant_score(
        quality,
        stability_value=stability.get("clusterStability"),
        outlier_rate=outlier_rate,
        cluster_count=len(valid_clusters),
        min_cluster_count=clustering_config.min_compacted_clusters,
    )
    return {
        "variant": variant_name,
        "score": score,
        "clusterCount": len(valid_clusters),
        "outlierRate": outlier_rate,
        "clusterDistinctiveness": quality.get("clusterDistinctiveness"),
        "positiveMarginRate": quality.get("positiveMarginRate"),
        "meanSeparationMargin": quality.get("meanSeparationMargin"),
        "semanticSilhouetteProxy": quality.get("semanticSilhouetteProxy"),
        "clusterStability": stability.get("clusterStability"),
        "hdbscanNoiseRate": hdbscan_summary.get("hdbscanNoiseRate"),
        "hdbscanSplitCandidateCount": hdbscan_summary.get("hdbscanSplitCandidateCount"),
        "sameIntentEdgeCount": same_intent_report.get("edgeCount"),
        "sameIntentConflictPairCount": same_intent_report.get("conflictPairCount"),
        "sameIntentAmbiguousPairCount": same_intent_report.get("ambiguousPairCount"),
        "sameIntentOvermergeRisk": same_intent_report.get("overmergeRisk"),
        **hdbscan_refinement,
        "clusterCompactionSelected": compaction_report.get("clusterCompactionSelected"),
        "clusterCompactionThreshold": compaction_report.get("clusterCompactionThreshold"),
        "clusterCompactionInputClusterCount": compaction_report.get("clusterCompactionInputClusterCount"),
        "clusterCompactionOutputClusterCount": compaction_report.get("clusterCompactionOutputClusterCount"),
        "clusterCompactionBlockedByHdbscanCount": compaction_report.get("clusterCompactionBlockedByHdbscanCount"),
        "passesOutlierGate": outlier_rate <= VARIANT_OUTLIER_RATE_GATE,
        "passesStabilityGate": _safe_float(stability.get("clusterStability")) >= VARIANT_CLUSTER_STABILITY_GATE,
        "passesDistinctivenessGate": _safe_float(quality.get("clusterDistinctiveness"))
        >= VARIANT_CLUSTER_DISTINCTIVENESS_GATE,
    }


def _select_clustering_candidate(
    *,
    vectors: np.ndarray,
    success_conversations: list[ProcessedConversation],
    flow_signatures: np.ndarray,
    embedding_runtime: str,
    embedding_model_name: str,
    embedding_source: str,
    clustering_config: _ClusteringConfig,
    threshold_candidates: Sequence[float],
    resolution_candidates: Sequence[float],
    feedback_constraints: Sequence[FeedbackConstraint],
    safe_merge_enabled: bool,
    safe_merge_min_score: float,
) -> _ClusteringCandidateResult:
    candidate_results: list[_ClusteringCandidateResult] = []
    for threshold in threshold_candidates:
        for resolution in resolution_candidates:
            candidate_results.append(
                _run_clustering_candidate(
                    vectors=vectors,
                    success_conversations=success_conversations,
                    flow_signatures=flow_signatures,
                    embedding_runtime=embedding_runtime,
                    embedding_model_name=embedding_model_name,
                    embedding_source=embedding_source,
                    clustering_config=clustering_config,
                    same_intent_threshold=threshold,
                    leiden_resolution=resolution,
                    feedback_constraints=feedback_constraints,
                    safe_merge_enabled=safe_merge_enabled,
                    safe_merge_min_score=safe_merge_min_score,
                )
            )

    if not candidate_results:
        raise PipelineStageError("Clustering config selection requires at least one candidate.")
    baseline = candidate_results[0]
    top_candidate = max(
        candidate_results,
        key=lambda candidate: (
            _safe_float(candidate.selection_report.get("score")),
            len(candidate.valid_clusters),
            -len(candidate.outlier_node_indices),
        ),
    )
    selected, selected_reason = _guarded_clustering_selection(baseline, top_candidate)
    selected_report = dict(selected.selection_report)
    selected_report.update(
        {
            "enabled": len(candidate_results) > 1,
            "selectedThreshold": selected.same_intent_threshold,
            "selectedLeidenResolution": selected.leiden_resolution,
            "selectedScore": selected.selection_report.get("score"),
            "selectedReason": selected_reason,
            "baselineScore": baseline.selection_report.get("score"),
            "topCandidateScore": top_candidate.selection_report.get("score"),
            "topCandidateThreshold": top_candidate.same_intent_threshold,
            "topCandidateLeidenResolution": top_candidate.leiden_resolution,
            "candidateCount": len(candidate_results),
            "candidates": [candidate.selection_report for candidate in candidate_results],
        }
    )
    return _ClusteringCandidateResult(
        same_intent_threshold=selected.same_intent_threshold,
        leiden_resolution=selected.leiden_resolution,
        memberships=selected.memberships,
        outlier_node_indices=selected.outlier_node_indices,
        valid_clusters=selected.valid_clusters,
        hdbscan_summary=selected.hdbscan_summary,
        hdbscan_refinement=selected.hdbscan_refinement,
        safe_merge_report=selected.safe_merge_report,
        outlier_reassignment_report=selected.outlier_reassignment_report,
        same_intent_report=selected.same_intent_report,
        selection_report=selected_report,
    )


def _guarded_clustering_selection(
    baseline: _ClusteringCandidateResult,
    top_candidate: _ClusteringCandidateResult,
) -> tuple[_ClusteringCandidateResult, str]:
    if top_candidate is baseline:
        return baseline, "baseline_best"
    score_gain = _safe_float(top_candidate.selection_report.get("score")) - _safe_float(
        baseline.selection_report.get("score")
    )
    if score_gain < MIN_CLUSTERING_SELECTION_SCORE_GAIN:
        return baseline, "baseline_guard_score_gain"
    baseline_distinctiveness = _safe_float(baseline.selection_report.get("clusterDistinctiveness"))
    candidate_distinctiveness = _safe_float(top_candidate.selection_report.get("clusterDistinctiveness"))
    if candidate_distinctiveness + MAX_CLUSTERING_DISTINCTIVENESS_REGRESSION < baseline_distinctiveness:
        return baseline, "baseline_guard_distinctiveness_regression"
    baseline_outlier_rate = _safe_float(baseline.selection_report.get("outlierRate"))
    candidate_outlier_rate = _safe_float(top_candidate.selection_report.get("outlierRate"))
    if candidate_outlier_rate > max(0.30, baseline_outlier_rate + 0.12):
        return baseline, "baseline_guard_outlier_regression"
    return top_candidate, "candidate_score_gain"


def _run_clustering_candidate(
    *,
    vectors: np.ndarray,
    success_conversations: list[ProcessedConversation],
    flow_signatures: np.ndarray,
    embedding_runtime: str,
    embedding_model_name: str,
    embedding_source: str,
    clustering_config: _ClusteringConfig,
    same_intent_threshold: float,
    leiden_resolution: float,
    feedback_constraints: Sequence[FeedbackConstraint],
    safe_merge_enabled: bool,
    safe_merge_min_score: float,
) -> _ClusteringCandidateResult:
    from pipeline.stages.intent_discovery.clustering import (
        detect_communities,
        hdbscan_assist_summary,
        identify_outliers,
        reassign_nearby_outliers,
        refine_clusters_with_hdbscan,
    )
    from pipeline.stages.intent_discovery.safe_merge import safe_merge_microclusters
    from pipeline.stages.intent_discovery.same_intent_graph import build_same_intent_probability_graph

    graph, same_intent_report = build_same_intent_probability_graph(
        success_conversations,
        vectors,
        flow_signatures,
        k=clustering_config.knn_k,
        base_threshold=same_intent_threshold,
        constraints=feedback_constraints,
    )
    memberships = detect_communities(graph, resolution=leiden_resolution)
    outlier_node_indices, valid_clusters = identify_outliers(
        memberships,
        min_size=clustering_config.min_cluster_size,
    )
    hdbscan_summary = hdbscan_assist_summary(
        vectors,
        valid_clusters,
        min_cluster_size=clustering_config.min_cluster_size,
        flow_signatures=flow_signatures,
        flow_weight=clustering_config.flow_affinity_weight,
        min_samples=clustering_config.hdbscan_min_samples,
    )
    hdbscan_labels = hdbscan_summary.get("hdbscanLabels")
    typed_hdbscan_labels = hdbscan_labels if isinstance(hdbscan_labels, list) else []
    outlier_node_indices, valid_clusters, hdbscan_refinement = refine_clusters_with_hdbscan(
        valid_clusters,
        outlier_node_indices,
        typed_hdbscan_labels,
        min_size=clustering_config.min_cluster_size,
    )
    if safe_merge_enabled:
        valid_clusters, safe_merge_report = safe_merge_microclusters(
            valid_clusters,
            success_conversations,
            vectors,
            flow_signatures,
            min_merge_score=safe_merge_min_score,
        )
        safe_merge_report["safeMergeEnabled"] = True
    else:
        safe_merge_report = {
            "safeMergeEnabled": False,
            "safeMergeReason": "disabled",
        }
    outlier_node_indices, valid_clusters, outlier_reassignment_report = reassign_nearby_outliers(
        valid_clusters,
        outlier_node_indices,
        vectors,
        success_conversations,
    )
    quality = build_semantic_quality_report(
        semantic_embeddings=vectors,
        valid_clusters=valid_clusters,
        embedding_runtime=embedding_runtime,
        embedding_model_name=embedding_model_name,
        embedding_source=embedding_source,
    )
    outlier_rate = len(outlier_node_indices) / vectors.shape[0] if vectors.shape[0] else 0.0
    score = _clustering_candidate_score(
        quality,
        same_intent_report=same_intent_report,
        outlier_rate=outlier_rate,
        cluster_count=len(valid_clusters),
        min_cluster_count=clustering_config.min_compacted_clusters,
    )
    selection_report: dict[str, object] = {
        "sameIntentThreshold": same_intent_threshold,
        "leidenResolution": leiden_resolution,
        "score": score,
        "clusterCount": len(valid_clusters),
        "outlierRate": outlier_rate,
        "clusterDistinctiveness": quality.get("clusterDistinctiveness"),
        "positiveMarginRate": quality.get("positiveMarginRate"),
        "meanSeparationMargin": quality.get("meanSeparationMargin"),
        "semanticSilhouetteProxy": quality.get("semanticSilhouetteProxy"),
        "sameIntentEdgeCount": same_intent_report.get("edgeCount"),
        "sameIntentAvgEdgeProbability": same_intent_report.get("avgEdgeProbability"),
        "sameIntentAmbiguousPairCount": same_intent_report.get("ambiguousPairCount"),
        "sameIntentConflictPairCount": same_intent_report.get("conflictPairCount"),
        "sameIntentEdgeHubnessMaxDegree": same_intent_report.get("edgeHubnessMaxDegree"),
        "sameIntentOvermergeRisk": same_intent_report.get("overmergeRisk"),
        "hdbscanSplitClusterCount": hdbscan_refinement.get("hdbscanSplitClusterCount"),
        "hdbscanPrunedMemberCount": hdbscan_refinement.get("hdbscanPrunedMemberCount"),
        "outlierReassignmentCount": outlier_reassignment_report.get("outlierReassignmentCount"),
        "safeMergeOutputClusterCount": safe_merge_report.get("safeMergeOutputClusterCount"),
    }
    return _ClusteringCandidateResult(
        same_intent_threshold=same_intent_threshold,
        leiden_resolution=leiden_resolution,
        memberships=memberships,
        outlier_node_indices=outlier_node_indices,
        valid_clusters=valid_clusters,
        hdbscan_summary=hdbscan_summary,
        hdbscan_refinement=hdbscan_refinement,
        safe_merge_report=safe_merge_report,
        outlier_reassignment_report=outlier_reassignment_report,
        same_intent_report=same_intent_report,
        selection_report=selection_report,
    )


def _clustering_candidate_score(
    quality: dict[str, object],
    *,
    same_intent_report: dict[str, object],
    outlier_rate: float,
    cluster_count: int,
    min_cluster_count: int,
) -> float:
    distinctiveness = _safe_float(quality.get("clusterDistinctiveness"))
    positive_margin_rate = _safe_float(quality.get("positiveMarginRate"))
    separation_margin = _safe_float(quality.get("meanSeparationMargin"))
    silhouette = _safe_float(quality.get("semanticSilhouetteProxy"))
    overmerge_risk = _safe_float(same_intent_report.get("overmergeRisk"))
    margin_score = max(0.0, min(1.0, (separation_margin + 0.08) / 0.16))
    outlier_score = max(0.0, min(1.0, 1.0 - (outlier_rate / 0.35)))
    node_count = max(1.0, _safe_float(same_intent_report.get("nodeCount")))
    target_cluster_count = _adaptive_cluster_count_target(node_count, min_cluster_count)
    cluster_count_score = min(1.0, cluster_count / target_cluster_count) if cluster_count > 0 else 0.0
    edge_hubness = _safe_float(same_intent_report.get("edgeHubnessMaxDegree"))
    hubness_score = max(0.0, min(1.0, 1.0 - (edge_hubness / max(4.0, node_count * 0.35))))
    base_score = (
        (0.38 * distinctiveness)
        + (0.20 * positive_margin_rate)
        + (0.12 * margin_score)
        + (0.09 * silhouette)
        + (0.07 * outlier_score)
        + (0.09 * cluster_count_score)
        + (0.05 * hubness_score)
    )
    coarse_cluster_deficit = max(0.0, ((target_cluster_count * 0.65) - cluster_count) / target_cluster_count)
    penalty = (
        max(0.0, outlier_rate - 0.30) * 0.9
        + max(0.0, 0.18 - distinctiveness) * 0.25
        + (overmerge_risk * 0.25)
        + (coarse_cluster_deficit * 0.20)
        + (0.12 if cluster_count < 2 else 0.0)
    )
    return base_score - penalty


def _adaptive_cluster_count_target(node_count: float, min_cluster_count: int) -> float:
    return max(float(min_cluster_count), min(32.0, node_count**0.5))


def _ordered_variant_names(candidates: dict[str, np.ndarray]) -> list[str]:
    preferred = [
        "role_weighted",
        "customer_only",
        "customer_dominant",
        "customer_full",
        "customer_resolution",
        "customer_full_resolution",
    ]
    preferred_names = [name for name in preferred if name in candidates]
    return preferred_names + sorted(name for name in candidates if name not in preferred)


def _semantic_variant_score(
    quality: dict[str, object],
    *,
    stability_value: object,
    outlier_rate: float,
    cluster_count: int,
    min_cluster_count: int,
) -> float:
    distinctiveness = _safe_float(quality.get("clusterDistinctiveness"))
    positive_margin_rate = _safe_float(quality.get("positiveMarginRate"))
    separation_margin = _safe_float(quality.get("meanSeparationMargin"))
    stability = _safe_float(stability_value)
    margin_score = max(0.0, min(1.0, (separation_margin + 0.08) / 0.16))
    outlier_score = max(0.0, min(1.0, 1.0 - (outlier_rate / 0.35)))
    cluster_count_score = 0.0 if cluster_count <= 1 else min(1.0, cluster_count / max(1, min_cluster_count))
    base_score = (
        (0.42 * distinctiveness)
        + (0.20 * positive_margin_rate)
        + (0.16 * margin_score)
        + (0.12 * stability)
        + (0.06 * outlier_score)
        + (0.04 * cluster_count_score)
    )
    gate_bonus = (
        (0.08 if distinctiveness >= VARIANT_CLUSTER_DISTINCTIVENESS_GATE else 0.0)
        + (0.08 if stability >= VARIANT_CLUSTER_STABILITY_GATE else 0.0)
        + (0.05 if outlier_rate <= VARIANT_OUTLIER_RATE_GATE else 0.0)
        + (0.03 if positive_margin_rate >= VARIANT_POSITIVE_MARGIN_GATE else 0.0)
    )
    gate_penalty = (
        max(0.0, outlier_rate - VARIANT_OUTLIER_RATE_GATE) * 1.0
        + max(0.0, VARIANT_CLUSTER_STABILITY_GATE - stability) * 0.8
        + max(0.0, VARIANT_CLUSTER_DISTINCTIVENESS_GATE - distinctiveness) * 0.4
    )
    return base_score + gate_bonus - gate_penalty


def _select_margin_compaction(
    *,
    valid_clusters: dict[int, list[int]],
    semantic_vectors: np.ndarray,
    semantic_embeddings: np.ndarray,
    embedding_runtime: str,
    embedding_model_name: str,
    embedding_source: str,
    thresholds: tuple[float, ...],
    min_compacted_clusters: int,
    hdbscan_labels: list[int],
    compact_fn: Callable[..., tuple[dict[int, list[int]], dict[str, object]]],
) -> tuple[dict[int, list[int]], dict[str, object]]:
    before_quality = build_semantic_quality_report(
        semantic_embeddings=semantic_embeddings,
        valid_clusters=valid_clusters,
        embedding_runtime=embedding_runtime,
        embedding_model_name=embedding_model_name,
        embedding_source=embedding_source,
    )
    baseline_score = _semantic_compaction_score(before_quality, len(valid_clusters), min_compacted_clusters)
    best_clusters = valid_clusters
    best_quality = before_quality
    best_report: dict[str, object] | None = None
    best_score = baseline_score

    for threshold in thresholds:
        compacted, report = compact_fn(
            valid_clusters,
            semantic_vectors,
            similarity_threshold=threshold,
            hdbscan_labels=hdbscan_labels,
        )
        if len(compacted) < min_compacted_clusters:
            continue
        quality = build_semantic_quality_report(
            semantic_embeddings=semantic_embeddings,
            valid_clusters=compacted,
            embedding_runtime=embedding_runtime,
            embedding_model_name=embedding_model_name,
            embedding_source=embedding_source,
        )
        score = _semantic_compaction_score(quality, len(compacted), min_compacted_clusters)
        if score > best_score:
            best_score = score
            best_clusters = compacted
            best_quality = quality
            best_report = report

    before_distinctiveness = _safe_float(before_quality.get("clusterDistinctiveness"))
    after_distinctiveness = _safe_float(best_quality.get("clusterDistinctiveness"))
    before_margin = _safe_float(before_quality.get("meanSeparationMargin"))
    after_margin = _safe_float(best_quality.get("meanSeparationMargin"))
    selected = best_report is not None and (
        after_distinctiveness >= before_distinctiveness + 0.02 or after_margin >= before_margin + 0.02
    )
    if best_report is None or not selected:
        return valid_clusters, {
            "clusterCompactionEnabled": True,
            "clusterCompactionSelected": False,
            "clusterCompactionReason": "no_margin_gain",
            "clusterCompactionInputClusterCount": len(valid_clusters),
            "clusterCompactionOutputClusterCount": len(valid_clusters),
            "clusterCompactionBeforeDistinctiveness": before_quality.get("clusterDistinctiveness"),
            "clusterCompactionAfterDistinctiveness": before_quality.get("clusterDistinctiveness"),
            "clusterCompactionBeforePositiveMarginRate": before_quality.get("positiveMarginRate"),
            "clusterCompactionAfterPositiveMarginRate": before_quality.get("positiveMarginRate"),
            "clusterCompactionBeforeSeparationMargin": before_quality.get("meanSeparationMargin"),
            "clusterCompactionAfterSeparationMargin": before_quality.get("meanSeparationMargin"),
            "clusterCompactionScoreBefore": baseline_score,
            "clusterCompactionScoreAfter": baseline_score,
        }

    report = dict(best_report)
    report.update(
        {
            "clusterCompactionEnabled": True,
            "clusterCompactionSelected": True,
            "clusterCompactionReason": "margin_gain",
            "clusterCompactionBeforeDistinctiveness": before_quality.get("clusterDistinctiveness"),
            "clusterCompactionAfterDistinctiveness": best_quality.get("clusterDistinctiveness"),
            "clusterCompactionBeforePositiveMarginRate": before_quality.get("positiveMarginRate"),
            "clusterCompactionAfterPositiveMarginRate": best_quality.get("positiveMarginRate"),
            "clusterCompactionBeforeSeparationMargin": before_quality.get("meanSeparationMargin"),
            "clusterCompactionAfterSeparationMargin": best_quality.get("meanSeparationMargin"),
            "clusterCompactionScoreBefore": baseline_score,
            "clusterCompactionScoreAfter": best_score,
        }
    )
    return best_clusters, report


def _semantic_compaction_score(
    quality: dict[str, object],
    cluster_count: int,
    min_compacted_clusters: int,
) -> float:
    distinctiveness = _safe_float(quality.get("clusterDistinctiveness"))
    positive_margin_rate = _safe_float(quality.get("positiveMarginRate"))
    separation_margin = _safe_float(quality.get("meanSeparationMargin"))
    margin_score = max(0.0, min(1.0, (separation_margin + 0.08) / 0.16))
    cluster_count_score = min(1.0, cluster_count / max(1, min_compacted_clusters))
    return (
        (0.55 * distinctiveness) + (0.25 * positive_margin_rate) + (0.15 * margin_score) + (0.05 * cluster_count_score)
    )


def _safe_float(value: object) -> float:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    return 0.0


def _write_semantic_quality_report(
    runtime_config: PipelineRuntimeConfig,
    context: StageContext,
    semantic_quality: dict[str, object],
) -> Path:
    output_dir = ensure_stage_directory(context, runtime_config)
    report_path = output_dir / SEMANTIC_QUALITY_REPORT_ARTIFACT
    report_path.write_text(json.dumps(semantic_quality, indent=2, ensure_ascii=False), encoding="utf-8")
    return report_path


def _semantic_quality_summary(semantic_quality: dict[str, object]) -> dict[str, object]:
    return {key: value for key, value in semantic_quality.items() if key != "clusters"}


def _load_representation_embeddings(
    runtime_config: PipelineRuntimeConfig,
    context: StageContext,
) -> tuple[np.ndarray, list[bool], dict[str, object], dict[str, np.ndarray]] | None:
    stage_dir = representation_stage_dir(runtime_config, context)
    embeddings_path = stage_dir / SEMANTIC_EMBEDDINGS_ARTIFACT
    variants_path = stage_dir / SEMANTIC_VARIANTS_ARTIFACT
    index_path = stage_dir / EMBEDDING_INDEX_ARTIFACT
    report_path = stage_dir / REPRESENTATION_REPORT_ARTIFACT
    if not embeddings_path.exists() or not index_path.exists():
        return None
    try:
        embeddings = np.load(embeddings_path)
        index_payload = json.loads(index_path.read_text(encoding="utf-8"))
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        raise PipelineStageError(f"Failed to read representation artifacts: {stage_dir}") from exc
    if not isinstance(index_payload, list):
        raise PipelineStageError(f"Embedding index must be a list: {index_path}")
    success_mask = [_embedding_success(item, index_path) for item in index_payload]
    if embeddings.shape[0] != len(success_mask):
        raise PipelineStageError(f"semantic_embeddings row count must match embedding index length: {embeddings_path}")
    metadata = _read_representation_report(report_path)
    base_embeddings = embeddings.astype(np.float32, copy=False)
    candidates = _read_representation_variants(variants_path, fallback=base_embeddings)
    for name, candidate in candidates.items():
        if candidate.shape != base_embeddings.shape:
            raise PipelineStageError(
                f"Representation variant {name!r} shape must match semantic_embeddings: {variants_path}"
            )
    return base_embeddings, success_mask, metadata, candidates


def _read_representation_variants(variants_path: Path, *, fallback: np.ndarray) -> dict[str, np.ndarray]:
    candidates = {"role_weighted": fallback.astype(np.float32, copy=False)}
    if not variants_path.exists():
        return candidates
    try:
        with np.load(variants_path) as payload:
            for name in payload.files:
                values = payload[name].astype(np.float32, copy=False)
                candidates[name] = values
    except (OSError, ValueError) as exc:
        raise PipelineStageError(f"Failed to read representation variants: {variants_path}") from exc
    return candidates


def _read_representation_report(report_path: Path) -> dict[str, object]:
    if not report_path.exists():
        return {}
    try:
        payload = json.loads(report_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PipelineStageError(f"Failed to read representation report: {report_path}") from exc
    if not isinstance(payload, dict):
        raise PipelineStageError(f"Representation report must be a JSON object: {report_path}")
    return cast(dict[str, object], payload)


def _embedding_success(item: object, path: Path) -> bool:
    if not isinstance(item, dict):
        raise PipelineStageError(f"Embedding index rows must be objects: {path}")
    value = cast(dict[str, object], item).get("embeddingSuccess")
    if isinstance(value, bool):
        return value
    raise PipelineStageError(f"Embedding index row embeddingSuccess must be a boolean: {path}")
