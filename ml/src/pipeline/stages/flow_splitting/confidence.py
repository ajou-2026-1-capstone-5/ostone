from __future__ import annotations

from collections import Counter
from typing import Any

import numpy as np

from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext

from .constants import (
    COMPOUND_SPLIT_SEPARATOR,
    MIN_ENTRYPOINT_DISTINCTIVENESS_FOR_SAMPLE,
    MIN_ENTRYPOINT_MARGIN_FOR_SAMPLE,
    WORKFLOW_HIGH_CONFIDENCE_THRESHOLD,
    WORKFLOW_HUMAN_REVIEW_CONFIDENCE_THRESHOLD,
    WORKFLOW_LABEL_BLOCKING_CONFIDENCE_THRESHOLD,
    WORKFLOW_LABEL_SAMPLE_REVIEW_THRESHOLD,
    WORKFLOW_REVIEW_CONFIDENCE_THRESHOLD,
)
from .helpers import (
    _clamp,
    _dedupe,
    _dominant_sequence_share,
    _dominant_signal_share,
    _float_value,
    _int_list,
    _is_mixed_residual_reason,
    _l2norm,
    _low_quality_member_ratio,
    _resolve_expanded_min_split_size,
    _split_reason_has_action,
    _split_reason_has_action_object,
    _split_reason_has_sequence,
    _string_list,
    _upstream_stage_dir,
    _workflow_label,
)
from .labeling import _weak_label_penalty


def _apply_entrypoint_semantic_metadata(
    clusters: list[dict[str, Any]],
    runtime_config: PipelineRuntimeConfig,
    stage_context: StageContext,
) -> dict[str, float | int]:
    vectors = _load_intent_discovery_embeddings(runtime_config, stage_context)
    if vectors is None or not clusters:
        return _entrypoint_semantic_report([], len(clusters))

    normalized = _l2norm(vectors.astype(np.float32, copy=False))
    cluster_indices = {
        position: [index for index in _int_list(cluster.get("member_indices")) if 0 <= index < normalized.shape[0]]
        for position, cluster in enumerate(clusters)
    }
    centroid_by_position = {
        position: _l2norm(normalized[indices].mean(axis=0, keepdims=True))[0]
        for position, indices in cluster_indices.items()
        if indices
    }
    quality_rows: list[dict[str, object]] = []
    for position, cluster in enumerate(clusters):
        indices = cluster_indices.get(position, [])
        centroid = centroid_by_position.get(position)
        if centroid is None or not indices:
            continue
        members = normalized[indices]
        cohesion = float(np.mean(members @ centroid)) if members.size else 0.0
        nearest = _nearest_entrypoint_centroid(position, centroid, centroid_by_position)
        nearest_position = nearest[0] if nearest is not None else None
        nearest_similarity = nearest[1] if nearest is not None else None
        margin = cohesion - nearest_similarity if nearest_similarity is not None else cohesion
        distinctiveness = _entrypoint_distinctiveness_score(margin)
        nearest_cluster = clusters[nearest_position] if nearest_position is not None else None
        semantic_quality = {
            "memberCount": len(indices),
            "cohesion": round(_clamp(cohesion), 6),
            "nearestCentroidSimilarity": None if nearest_similarity is None else round(_clamp(nearest_similarity), 6),
            "nearestCompetitorWorkflowEntryPointId": _semantic_competitor_value(
                nearest_cluster,
                "workflow_entrypoint_id",
            ),
            "nearestCompetitorClusterId": _semantic_competitor_value(nearest_cluster, "cluster_id"),
            "nearestCompetitorName": _workflow_label(nearest_cluster) if isinstance(nearest_cluster, dict) else None,
            "separationMargin": round(max(-1.0, min(1.0, margin)), 6),
            "distinctiveness": round(distinctiveness, 6),
        }
        cluster["entrypoint_semantic_quality"] = semantic_quality
        quality = cluster.get("quality")
        if not isinstance(quality, dict):
            quality = {}
        else:
            quality = dict(quality)
        quality["entrypoint_semantic_cohesion"] = semantic_quality["cohesion"]
        quality["entrypoint_semantic_separation_margin"] = semantic_quality["separationMargin"]
        quality["entrypoint_semantic_distinctiveness"] = semantic_quality["distinctiveness"]
        cluster["quality"] = quality
        quality_rows.append(semantic_quality)
    return _entrypoint_semantic_report(quality_rows, len(clusters))


def _load_intent_discovery_embeddings(
    runtime_config: PipelineRuntimeConfig,
    stage_context: StageContext,
) -> np.ndarray | None:
    path = _upstream_stage_dir("intent_discovery", runtime_config, stage_context) / "embeddings.npy"
    if not path.exists():
        return None
    try:
        payload = np.load(path)
    except (OSError, ValueError):
        return None
    if payload.ndim != 2:
        return None
    return payload.astype(np.float32, copy=False)


def _nearest_entrypoint_centroid(
    position: int,
    centroid: np.ndarray,
    centroid_by_position: dict[int, np.ndarray],
) -> tuple[int, float] | None:
    similarities = sorted(
        (
            (other_position, float(centroid @ other_centroid))
            for other_position, other_centroid in centroid_by_position.items()
            if other_position != position
        ),
        key=lambda item: (-item[1], item[0]),
    )
    return similarities[0] if similarities else None


def _semantic_competitor_value(cluster: object, key: str) -> object:
    if not isinstance(cluster, dict):
        return None
    value = cluster.get(key)
    if isinstance(value, (str, int, float)) and not isinstance(value, bool):
        return value
    return None


def _entrypoint_semantic_report(
    rows: list[dict[str, object]],
    total_count: int,
) -> dict[str, float | int]:
    if not rows:
        return {
            "entrypointSemanticCoverage": 0.0,
            "entrypointSemanticCohesion": 0.0,
            "entrypointSemanticSeparationMargin": 0.0,
            "entrypointDistinctiveness": 0.0,
            "entrypointPositiveMarginRate": 0.0,
        }
    cohesion_values = [_float_value(row.get("cohesion"), default=0.0) for row in rows]
    margin_values = [_float_value(row.get("separationMargin"), default=0.0) for row in rows]
    distinctiveness_values = [_float_value(row.get("distinctiveness"), default=0.0) for row in rows]
    return {
        "entrypointSemanticCoverage": len(rows) / total_count if total_count > 0 else 0.0,
        "entrypointSemanticCohesion": sum(cohesion_values) / len(cohesion_values),
        "entrypointSemanticSeparationMargin": sum(margin_values) / len(margin_values),
        "entrypointDistinctiveness": sum(distinctiveness_values) / len(distinctiveness_values),
        "entrypointPositiveMarginRate": sum(1 for value in margin_values if value > 0.0) / len(margin_values),
    }


def _entrypoint_distinctiveness_score(margin: float) -> float:
    return _clamp((margin + 0.02) / 0.12)


def _apply_workflow_review_metadata(
    clusters: list[dict[str, Any]],
    entrypoints: list[dict[str, Any]],
    preprocessed_index: dict[str, dict[str, Any]],
    *,
    total_member_count: int,
    min_split_size: int,
) -> None:
    label_counts = Counter(_workflow_label(cluster) for cluster in clusters)
    entrypoint_by_id = {
        str(entrypoint.get("entryPointId")): entrypoint
        for entrypoint in entrypoints
        if isinstance(entrypoint.get("entryPointId"), str)
    }
    for cluster in clusters:
        split_reason = str(cluster.get("flow_split_key") or cluster.get("splitReason") or "single_flow")
        label = _workflow_label(cluster)
        confidence_payload = _workflow_confidence_payload(
            cluster,
            split_reason=split_reason,
            preprocessed_index=preprocessed_index,
            total_member_count=total_member_count,
            min_split_size=min_split_size,
            duplicate_label_count=label_counts[label],
        )
        cluster.update(confidence_payload)
        entrypoint = entrypoint_by_id.get(str(cluster.get("workflow_entrypoint_id")))
        if entrypoint is not None:
            entrypoint["confidence"] = confidence_payload["workflow_confidence"]
            entrypoint["confidenceComponents"] = confidence_payload["workflow_confidence_components"]
            entrypoint["needsHumanReview"] = confidence_payload["needs_human_review"]
            entrypoint["reviewReasonCodes"] = confidence_payload["review_reason_codes"]
            entrypoint["sampleReviewReasonCodes"] = confidence_payload["sample_review_reason_codes"]
            entrypoint["reviewTier"] = confidence_payload["review_tier"]
            entrypoint["coverageShare"] = confidence_payload["coverage_share"]
            semantic_quality = cluster.get("entrypoint_semantic_quality")
            if isinstance(semantic_quality, dict):
                entrypoint["semanticQuality"] = semantic_quality


def _workflow_confidence_payload(
    cluster: dict[str, Any],
    *,
    split_reason: str,
    preprocessed_index: dict[str, dict[str, Any]],
    total_member_count: int,
    min_split_size: int,
    duplicate_label_count: int,
) -> dict[str, Any]:
    member_ids = _string_list(cluster.get("member_conv_ids"))
    low_quality_ratio = _low_quality_member_ratio(member_ids, preprocessed_index)
    coverage_share = len(member_ids) / total_member_count if total_member_count > 0 else 0.0
    support_min_split_size = _support_min_split_size(split_reason, min_split_size)
    components = {
        "semantic": _semantic_confidence(cluster),
        "flow": _flow_confidence(member_ids, preprocessed_index, split_reason),
        "evidence": _evidence_confidence(cluster, member_ids, support_min_split_size),
        "label": _label_confidence(cluster, duplicate_label_count),
        "support": _support_confidence(member_ids, support_min_split_size),
        "safety": max(0.0, 1.0 - low_quality_ratio),
    }
    confidence = round(
        (0.22 * components["semantic"])
        + (0.22 * components["flow"])
        + (0.18 * components["evidence"])
        + (0.16 * components["label"])
        + (0.12 * components["support"])
        + (0.10 * components["safety"]),
        4,
    )
    reason_codes = _review_reason_codes(
        confidence=confidence,
        components=components,
        split_reason=split_reason,
        coverage_share=coverage_share,
        duplicate_label_count=duplicate_label_count,
        low_quality_ratio=low_quality_ratio,
    )
    if cluster.get("is_novel_outlier_candidate") is True:
        reason_codes.append("novel_outlier_candidate")
    weak_semantic_boundary_sample = False
    if _has_weak_entrypoint_semantic_boundary(cluster):
        if _should_sample_weak_entrypoint_semantic_boundary(
            confidence=confidence,
            components=components,
            reason_codes=reason_codes,
        ):
            weak_semantic_boundary_sample = True
        else:
            reason_codes.append("weak_semantic_boundary")
    reason_codes = _dedupe(reason_codes)
    sample_reason_codes = _sample_review_reason_codes(
        components=components,
        duplicate_label_count=duplicate_label_count,
        weak_semantic_boundary_sample=weak_semantic_boundary_sample,
    )
    needs_review = bool(reason_codes)
    return {
        "workflow_confidence": confidence,
        "workflow_confidence_components": components,
        "needs_human_review": needs_review,
        "review_reason_codes": reason_codes,
        "sample_review_reason_codes": sample_reason_codes,
        "review_tier": _review_tier(confidence, needs_review, has_sample_review=bool(sample_reason_codes)),
        "coverage_share": round(coverage_share, 6),
        "duplicate_label_count": duplicate_label_count,
        "low_quality_member_ratio": low_quality_ratio,
        "support_min_split_size": support_min_split_size,
    }


def _support_min_split_size(split_reason: str, min_split_size: int) -> int:
    if COMPOUND_SPLIT_SEPARATOR in split_reason and (
        _split_reason_has_action(split_reason)
        or _split_reason_has_action_object(split_reason)
        or _split_reason_has_sequence(split_reason)
    ):
        return _resolve_expanded_min_split_size(min_split_size)
    return min_split_size


def _semantic_confidence(cluster: dict[str, Any]) -> float:
    quality = cluster.get("quality")
    values: list[float] = []
    if isinstance(quality, dict):
        for key in ("interpretability_score", "workflow_consistency_score", "branching_explainability_score"):
            value = quality.get(key)
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                values.append(_clamp(float(value)))
        entrypoint_score = _entrypoint_semantic_confidence(quality)
    else:
        entrypoint_score = None
    if values:
        base_score = sum(values) / len(values)
        if entrypoint_score is not None:
            return _clamp((0.72 * base_score) + (0.28 * entrypoint_score))
        return base_score
    return 0.5


def _entrypoint_semantic_confidence(quality: dict[str, Any]) -> float | None:
    cohesion = quality.get("entrypoint_semantic_cohesion")
    distinctiveness = quality.get("entrypoint_semantic_distinctiveness")
    margin = quality.get("entrypoint_semantic_separation_margin")
    if not isinstance(cohesion, (int, float)) or isinstance(cohesion, bool):
        return None
    if not isinstance(distinctiveness, (int, float)) or isinstance(distinctiveness, bool):
        return None
    margin_score = 0.5
    if isinstance(margin, (int, float)) and not isinstance(margin, bool):
        margin_score = _clamp((float(margin) + 0.04) / 0.12)
    return _clamp((0.50 * _clamp(float(cohesion))) + (0.35 * _clamp(float(distinctiveness))) + (0.15 * margin_score))


def _has_weak_entrypoint_semantic_boundary(cluster: dict[str, Any]) -> bool:
    quality = cluster.get("entrypoint_semantic_quality")
    if not isinstance(quality, dict):
        return False
    distinctiveness = quality.get("distinctiveness")
    margin = quality.get("separationMargin")
    if not isinstance(distinctiveness, (int, float)) or isinstance(distinctiveness, bool):
        return False
    if not isinstance(margin, (int, float)) or isinstance(margin, bool):
        return False
    return (
        float(distinctiveness) < MIN_ENTRYPOINT_DISTINCTIVENESS_FOR_SAMPLE
        and float(margin) < MIN_ENTRYPOINT_MARGIN_FOR_SAMPLE
    )


def _should_sample_weak_entrypoint_semantic_boundary(
    *,
    confidence: float,
    components: dict[str, float],
    reason_codes: list[str],
) -> bool:
    if reason_codes:
        return False
    return (
        confidence >= WORKFLOW_HUMAN_REVIEW_CONFIDENCE_THRESHOLD
        and components["flow"] >= 0.60
        and components["evidence"] >= 0.60
        and components["label"] >= WORKFLOW_LABEL_BLOCKING_CONFIDENCE_THRESHOLD
        and components["support"] >= 0.60
    )


def _flow_confidence(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
    split_reason: str,
) -> float:
    if not member_ids:
        return 0.0
    if _is_mixed_residual_reason(split_reason):
        return 0.45
    sequence_share = _dominant_sequence_share(member_ids, preprocessed_index)
    signal_share = _dominant_signal_share(member_ids, preprocessed_index)
    return _clamp((0.65 * max(sequence_share, 0.5)) + (0.35 * max(signal_share, 0.5)))


def _evidence_confidence(
    cluster: dict[str, Any],
    member_ids: list[str],
    min_split_size: int,
) -> float:
    exemplar_count = len(_string_list(cluster.get("exemplar_conv_ids")))
    keyword_count = len(_string_list(cluster.get("keywords")))
    exemplar_score = min(1.0, exemplar_count / 3.0)
    keyword_score = min(1.0, keyword_count / 5.0)
    support_score = _support_confidence(member_ids, min_split_size)
    return _clamp((0.40 * exemplar_score) + (0.30 * keyword_score) + (0.30 * support_score))


def _label_confidence(cluster: dict[str, Any], duplicate_label_count: int) -> float:
    value = cluster.get("label_score")
    base = _clamp(float(value)) if isinstance(value, (int, float)) and not isinstance(value, bool) else 0.55
    evidence_value = cluster.get("label_evidence_coverage")
    evidence = (
        _clamp(float(evidence_value))
        if isinstance(evidence_value, (int, float)) and not isinstance(evidence_value, bool)
        else base
    )
    action_value = cluster.get("label_action_object_validity")
    action_object = (
        _clamp(float(action_value))
        if isinstance(action_value, (int, float)) and not isinstance(action_value, bool)
        else 0.55
    )
    base = (0.58 * base) + (0.27 * evidence) + (0.15 * action_object)
    duplicate_penalty = 0.15 if duplicate_label_count > 1 else 0.0
    label = str(cluster.get("suggested_name") or cluster.get("canonical_intent") or "")
    weak_label_penalty = _weak_label_penalty(label)
    return _clamp(base - duplicate_penalty - weak_label_penalty)


def _support_confidence(member_ids: list[str], min_split_size: int) -> float:
    if not member_ids:
        return 0.0
    return min(1.0, len(member_ids) / max(1, min_split_size * 1.5))


def _review_reason_codes(
    *,
    confidence: float,
    components: dict[str, float],
    split_reason: str,
    coverage_share: float,
    duplicate_label_count: int,
    low_quality_ratio: float,
) -> list[str]:
    reasons: list[str] = []
    if confidence < WORKFLOW_HUMAN_REVIEW_CONFIDENCE_THRESHOLD:
        reasons.append("low_workflow_confidence")
    if components["flow"] < 0.60:
        reasons.append("weak_flow_signature")
    if components["evidence"] < 0.60:
        reasons.append("weak_evidence_support")
    if components["label"] < WORKFLOW_LABEL_BLOCKING_CONFIDENCE_THRESHOLD:
        reasons.append("weak_or_duplicate_label")
    if duplicate_label_count > 1:
        reasons.append("duplicate_label")
    if _is_mixed_residual_reason(split_reason):
        reasons.append("mixed_residual_flow")
    if coverage_share >= 0.25:
        reasons.append("large_coverage_share")
    if low_quality_ratio >= 0.40:
        reasons.append("low_quality_member_share")
    return _dedupe(reasons)


def _sample_review_reason_codes(
    *,
    components: dict[str, float],
    duplicate_label_count: int,
    weak_semantic_boundary_sample: bool = False,
) -> list[str]:
    reasons: list[str] = []
    if duplicate_label_count > 1:
        return []
    label_confidence = components["label"]
    if WORKFLOW_LABEL_BLOCKING_CONFIDENCE_THRESHOLD <= label_confidence < WORKFLOW_LABEL_SAMPLE_REVIEW_THRESHOLD:
        reasons.append("weak_label_sample")
    if weak_semantic_boundary_sample:
        reasons.append("weak_semantic_boundary_sample")
    return reasons


def _review_tier(confidence: float, needs_review: bool, *, has_sample_review: bool = False) -> str:
    if needs_review:
        return "human_review"
    if has_sample_review:
        return "sample_review"
    if confidence >= WORKFLOW_HIGH_CONFIDENCE_THRESHOLD:
        return "high_confidence"
    return "sample_review"


def _workflow_confidence_report(clusters: list[dict[str, Any]]) -> dict[str, Any]:
    if not clusters:
        return {
            "workflowConfidenceAvg": 0.0,
            "workflowConfidenceMin": 0.0,
            "highConfidenceWorkflowCount": 0,
            "reviewRequiredWorkflowCount": 0,
            "reviewRequiredRate": 0.0,
            "lowConfidenceWorkflowCount": 0,
            "duplicateLabelRate": 0.0,
            "maxWorkflowCoverage": 0.0,
            "effectiveWorkflowCount": 0.0,
        }
    confidences = [_float_value(cluster.get("workflow_confidence"), default=0.0) for cluster in clusters]
    review_count = sum(1 for cluster in clusters if cluster.get("needs_human_review") is True)
    low_confidence_count = sum(1 for confidence in confidences if confidence < WORKFLOW_REVIEW_CONFIDENCE_THRESHOLD)
    primary_clusters = [cluster for cluster in clusters if cluster.get("is_novel_outlier_candidate") is not True]
    duplicate_metric_clusters = primary_clusters or clusters
    labels = [_workflow_label(cluster) for cluster in duplicate_metric_clusters]
    duplicate_labels = {label for label, count in Counter(labels).items() if count > 1}
    review_candidate_labels = [
        _workflow_label(cluster) for cluster in clusters if cluster.get("is_novel_outlier_candidate") is True
    ]
    review_candidate_duplicates = {label for label, count in Counter(review_candidate_labels).items() if count > 1}
    review_candidate_duplicate_count = sum(
        1 for label in review_candidate_labels if label in review_candidate_duplicates
    )
    coverage_shares = [_float_value(cluster.get("coverage_share"), default=0.0) for cluster in clusters]
    return {
        "workflowConfidenceAvg": sum(confidences) / len(confidences),
        "workflowConfidenceMin": min(confidences),
        "highConfidenceWorkflowCount": sum(
            1 for cluster in clusters if cluster.get("review_tier") == "high_confidence"
        ),
        "sampleReviewWorkflowCount": sum(1 for cluster in clusters if cluster.get("review_tier") == "sample_review"),
        "reviewRequiredWorkflowCount": review_count,
        "reviewRequiredRate": review_count / len(clusters),
        "lowConfidenceWorkflowCount": low_confidence_count,
        "duplicateLabelRate": sum(1 for label in labels if label in duplicate_labels) / len(labels),
        "reviewCandidateDuplicateLabelRate": (
            review_candidate_duplicate_count / len(review_candidate_labels) if review_candidate_labels else 0.0
        ),
        "maxWorkflowCoverage": max(coverage_shares) if coverage_shares else 0.0,
        "effectiveWorkflowCount": _effective_workflow_count(coverage_shares),
    }


def _effective_workflow_count(coverage_shares: list[float]) -> float:
    denominator = sum(value * value for value in coverage_shares if value > 0.0)
    return (1.0 / denominator) if denominator > 0.0 else 0.0
