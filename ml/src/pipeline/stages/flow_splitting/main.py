from __future__ import annotations

import json
import os
from typing import Any, cast

from pipeline.common.artifacts import ensure_stage_directory, write_stage_manifest
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineStageError
from pipeline.stages.preprocessing.io import read_stage_context

from .constants import (
    CLUSTERS_ARTIFACT,
    FLOW_SPLIT_REPORT_ARTIFACT,
    FLOW_SPLIT_STRATEGIES,
    MIN_SPLIT_SIZE,
    NOVEL_REVIEW_CANDIDATE_MIN_SIZE,
    WORKFLOW_ENTRYPOINTS_ARTIFACT,
)
from .confidence import (
    _apply_entrypoint_semantic_metadata,
    _apply_workflow_review_metadata,
    _evidence_confidence,
    _has_weak_entrypoint_semantic_boundary,
    _review_reason_codes,
    _review_tier,
    _sample_review_reason_codes,
    _semantic_confidence,
    _support_confidence,
    _workflow_confidence_payload,
    _workflow_confidence_report,
)
from .helpers import (
    _cluster_member_id_set,
    _drop_low_quality_clusters,
    _extend_unique,
    _int_list,
    _member_index_lookup,
    _member_indices_for_ids,
    _merge_duplicate_intent_labels,
    _merged_workflow_signal,
    _read_json,
    _read_preprocessed_index,
    _split_label,
    _split_name,
    _split_reason_has_action,
    _split_reason_has_action_object,
    _split_reason_has_sequence,
    _string_list,
    _upstream_stage_dir,
)
from .labeling import (
    _enforce_review_only_labels,
    _regenerated_split_label,
    _resolve_duplicate_generated_labels,
    _review_safe_generated_label,
    _score_split_label_candidate,
    _split_label_auto_acceptable,
    _unique_duplicate_fallback_name,
)
from .novel import _promote_novel_candidates, _stabilized_novel_label
from .splitting import (
    _apply_regenerated_label_metadata,
    _flow_groups,
)


def run(upstream_manifest_path: str | None = None) -> dict[str, object]:
    runtime_config = PipelineRuntimeConfig.from_env()
    stage_context = read_stage_context(upstream_manifest_path, stage_name="flow_splitting")
    output_dir = ensure_stage_directory(stage_context, runtime_config)
    split_strategy = _resolve_flow_split_strategy()
    min_split_size = _resolve_min_split_size()
    clusters_payload = _read_json(
        _upstream_stage_dir("intent_discovery", runtime_config, stage_context) / CLUSTERS_ARTIFACT
    )
    preprocessed_index = _read_preprocessed_index(runtime_config, stage_context)

    clusters = clusters_payload.get("clusters")
    if not isinstance(clusters, list):
        raise PipelineStageError("intent_discovery clusters.json must contain a clusters list.")
    member_index_lookup = _member_index_lookup(runtime_config, stage_context, clusters_payload)
    compacted_clusters = _merge_duplicate_intent_labels(clusters, preprocessed_index)
    quality_filtered_clusters, low_quality_filter_report = _drop_low_quality_clusters(
        compacted_clusters,
        preprocessed_index,
    )
    novel_review_clusters, novel_review_report = _promote_novel_candidates(
        clusters_payload,
        preprocessed_index,
        existing_member_ids=_cluster_member_id_set(quality_filtered_clusters),
        min_size=NOVEL_REVIEW_CANDIDATE_MIN_SIZE,
    )
    candidate_clusters = quality_filtered_clusters + novel_review_clusters

    split_clusters: list[dict[str, Any]] = []
    entrypoints: list[dict[str, Any]] = []
    split_count = 0
    next_cluster_id = 0
    for cluster in candidate_clusters:
        if not isinstance(cluster, dict):
            continue
        groups = _flow_groups(
            cast(dict[str, Any], cluster),
            preprocessed_index,
            strategy=split_strategy,
            min_split_size=min_split_size,
        )
        if len(groups) <= 1:
            group_key = next(iter(groups), "single_flow")
            split_reason = "mixed_flow" if group_key == "mixed_flow" else group_key
            copied = dict(cluster)
            copied["workflow_entrypoint_id"] = f"entrypoint-{next_cluster_id}"
            copied["source_cluster_id"] = cluster.get("cluster_id")
            copied["cluster_id"] = next_cluster_id
            copied["flow_split_key"] = split_reason
            copied["workflow_signal"] = _merged_workflow_signal(
                _string_list(copied.get("member_conv_ids")),
                preprocessed_index,
                cluster.get("workflow_signal"),
            )
            copied["member_indices"] = _member_indices_for_ids(
                _string_list(copied.get("member_conv_ids")),
                member_index_lookup,
                fallback=_int_list(copied.get("member_indices")),
            )
            copied["cluster_size"] = len(_string_list(copied.get("member_conv_ids")))
            _apply_regenerated_label_metadata(
                copied,
                cluster,
                _string_list(copied.get("member_conv_ids")),
                preprocessed_index,
                split_reason,
            )
            split_clusters.append(copied)
            entrypoints.append(_entrypoint(copied, split_reason=split_reason))
            next_cluster_id += 1
            continue
        split_count += len(groups) - 1
        for key, member_ids in groups.items():
            copied = dict(cluster)
            copied["workflow_entrypoint_id"] = f"entrypoint-{next_cluster_id}"
            copied["source_cluster_id"] = cluster.get("cluster_id")
            copied["cluster_id"] = next_cluster_id
            copied["member_conv_ids"] = member_ids
            copied["cluster_size"] = len(member_ids)
            split_exemplars = [conv_id for conv_id in cluster.get("exemplar_conv_ids", []) if conv_id in member_ids][:5]
            copied["exemplar_conv_ids"] = split_exemplars or member_ids[:5]
            copied["flow_split_key"] = key
            copied["workflow_signal"] = _merged_workflow_signal(
                member_ids,
                preprocessed_index,
                cluster.get("workflow_signal"),
            )
            copied["member_indices"] = _member_indices_for_ids(member_ids, member_index_lookup)
            _apply_regenerated_label_metadata(copied, cluster, member_ids, preprocessed_index, key)
            split_clusters.append(copied)
            entrypoints.append(_entrypoint(copied, split_reason=key))
            next_cluster_id += 1

    _resolve_duplicate_generated_labels(split_clusters, preprocessed_index)
    _enforce_review_only_labels(split_clusters)
    entrypoint_semantic_report = _apply_entrypoint_semantic_metadata(split_clusters, runtime_config, stage_context)
    output_payload = dict(clusters_payload)
    output_payload["schema_version"] = "2.0"
    output_payload["stage"] = "flow_splitting"
    _apply_workflow_review_metadata(
        split_clusters,
        entrypoints,
        preprocessed_index,
        total_member_count=_total_member_count(candidate_clusters),
        min_split_size=min_split_size,
    )
    output_payload["clusters"] = split_clusters
    output_payload["workflow_entrypoints_path"] = WORKFLOW_ENTRYPOINTS_ARTIFACT
    confidence_report = _workflow_confidence_report(split_clusters)
    report = {
        "schemaVersion": "flow-splitting.v2",
        "inputClusterCount": len(clusters),
        "compactedClusterCount": len(compacted_clusters),
        **low_quality_filter_report,
        **novel_review_report,
        "outputEntryPointCount": len(entrypoints),
        "splitCount": split_count,
        "minSplitSize": min_split_size,
        "splitStrategy": split_strategy,
        "mixedFlowCount": _split_reason_count(entrypoints, "mixed_flow"),
        "mixedResidualCount": _split_reason_count(entrypoints, "mixed_residual"),
        "sequenceSplitCount": sum(
            1 for entrypoint in entrypoints if _split_reason_has_sequence(str(entrypoint.get("splitReason", "")))
        ),
        "actionObjectSplitCount": sum(
            1 for entrypoint in entrypoints if _split_reason_has_action_object(str(entrypoint.get("splitReason", "")))
        ),
        "actionSplitCount": sum(
            1 for entrypoint in entrypoints if _split_reason_has_action(str(entrypoint.get("splitReason", "")))
        ),
        "workflowSeparability": _workflow_separability(entrypoints),
        **entrypoint_semantic_report,
        **confidence_report,
    }
    output_payload["flow_split_metrics"] = report
    clusters_path = output_dir / CLUSTERS_ARTIFACT
    entrypoints_path = output_dir / WORKFLOW_ENTRYPOINTS_ARTIFACT
    report_path = output_dir / FLOW_SPLIT_REPORT_ARTIFACT
    clusters_path.write_text(json.dumps(output_payload, indent=2, ensure_ascii=False), encoding="utf-8")
    entrypoints_path.write_text(
        json.dumps({"workflowEntryPoints": entrypoints}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    manifest_path = write_stage_manifest(
        stage_context,
        runtime_config,
        {
            "upstream_manifest_path": upstream_manifest_path,
            "artifact_path": clusters_path.name,
            "workflowEntryPointsPath": entrypoints_path.name,
            "reportPath": report_path.name,
            "recordCount": len(entrypoints),
            "metrics": report,
        },
    )
    return {"artifact_manifest_path": str(manifest_path.resolve())}


def _resolve_flow_split_strategy() -> str:
    strategy = os.getenv("PIPELINE_FLOW_SPLIT_STRATEGY", "expanded").strip().lower()
    if strategy not in FLOW_SPLIT_STRATEGIES:
        return "conservative"
    return strategy


def _resolve_min_split_size() -> int:
    value = os.getenv("PIPELINE_FLOW_MIN_SPLIT_SIZE", "").strip()
    if not value:
        return MIN_SPLIT_SIZE
    try:
        parsed = int(value)
    except ValueError:
        return MIN_SPLIT_SIZE
    return parsed if parsed > 0 else MIN_SPLIT_SIZE


def _workflow_separability(entrypoints: list[dict[str, Any]]) -> float:
    if not entrypoints:
        return 0.0
    mixed_count = sum(1 for entrypoint in entrypoints if entrypoint.get("splitReason") == "mixed_flow")
    return 1.0 - (mixed_count / len(entrypoints))


def _split_reason_count(entrypoints: list[dict[str, Any]], reason: str) -> int:
    return sum(1 for entrypoint in entrypoints if entrypoint.get("splitReason") == reason)


def _entrypoint(cluster: dict[str, Any], split_reason: str) -> dict[str, Any]:
    source_cluster_ids = cluster.get("source_cluster_ids")
    member_ids = _string_list(cluster.get("member_conv_ids"))
    return {
        "entryPointId": cluster["workflow_entrypoint_id"],
        "intentClusterId": cluster["cluster_id"],
        "sourceClusterId": cluster.get("source_cluster_id"),
        "sourceClusterIds": source_cluster_ids if isinstance(source_cluster_ids, list) else [],
        "memberConversationIds": member_ids,
        "exemplarConversationIds": _string_list(cluster.get("exemplar_conv_ids")),
        "splitReason": split_reason,
        "memberCount": len(member_ids),
        "confidence": _confidence(cluster),
    }


def _total_member_count(clusters: list[dict[str, Any]]) -> int:
    return sum(len(_string_list(cluster.get("member_conv_ids"))) for cluster in clusters)


def _confidence(cluster: dict[str, Any]) -> float:
    quality = cluster.get("quality")
    if not isinstance(quality, dict):
        return 0.5
    values = [
        value
        for key in ("interpretability_score", "workflow_consistency_score", "branching_explainability_score")
        if isinstance((value := quality.get(key)), (int, float))
    ]
    return float(sum(values) / len(values)) if values else 0.5


__all__ = ["run"]
