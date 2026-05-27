from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Any, cast

from pipeline.common.artifacts import ensure_stage_directory, write_stage_manifest
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineStageError
from pipeline.stages.preprocessing.io import read_stage_context

CLUSTERS_ARTIFACT = "clusters.json"
WORKFLOW_ENTRYPOINTS_ARTIFACT = "workflow_entrypoints.json"
FLOW_SPLIT_REPORT_ARTIFACT = "flow_split_report.json"
MIN_SPLIT_SIZE = 3


def run(upstream_manifest_path: str | None = None) -> dict[str, object]:
    runtime_config = PipelineRuntimeConfig.from_env()
    stage_context = read_stage_context(upstream_manifest_path, stage_name="flow_splitting")
    output_dir = ensure_stage_directory(stage_context, runtime_config)
    clusters_payload = _read_json(
        _upstream_stage_dir("intent_discovery", runtime_config, stage_context) / CLUSTERS_ARTIFACT
    )
    preprocessed_index = _read_preprocessed_index(runtime_config, stage_context)

    clusters = clusters_payload.get("clusters")
    if not isinstance(clusters, list):
        raise PipelineStageError("intent_discovery clusters.json must contain a clusters list.")

    split_clusters: list[dict[str, Any]] = []
    entrypoints: list[dict[str, Any]] = []
    split_count = 0
    next_cluster_id = 0
    for cluster in clusters:
        if not isinstance(cluster, dict):
            continue
        groups = _flow_groups(cast(dict[str, Any], cluster), preprocessed_index)
        if len(groups) <= 1:
            group_key = next(iter(groups), "single_flow")
            split_reason = "mixed_flow" if group_key == "mixed_flow" else "single_flow"
            copied = dict(cluster)
            copied["workflow_entrypoint_id"] = f"entrypoint-{next_cluster_id}"
            copied["source_cluster_id"] = cluster.get("cluster_id")
            copied["cluster_id"] = next_cluster_id
            copied["workflow_signal"] = _merged_workflow_signal(
                _string_list(copied.get("member_conv_ids")),
                preprocessed_index,
                cluster.get("workflow_signal"),
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
            split_exemplars = [conv_id for conv_id in cluster.get("exemplar_conv_ids", []) if conv_id in member_ids][:5]
            copied["exemplar_conv_ids"] = split_exemplars or member_ids[:5]
            copied["suggested_name"] = f"{cluster.get('suggested_name', 'Intent')} / {key}"
            copied["flow_split_key"] = key
            copied["workflow_signal"] = _merged_workflow_signal(
                member_ids,
                preprocessed_index,
                cluster.get("workflow_signal"),
            )
            split_clusters.append(copied)
            entrypoints.append(_entrypoint(copied, split_reason=key))
            next_cluster_id += 1

    output_payload = dict(clusters_payload)
    output_payload["schema_version"] = "2.0"
    output_payload["stage"] = "flow_splitting"
    output_payload["clusters"] = split_clusters
    output_payload["workflow_entrypoints_path"] = WORKFLOW_ENTRYPOINTS_ARTIFACT
    report = {
        "schemaVersion": "flow-splitting.v2",
        "inputClusterCount": len(clusters),
        "outputEntryPointCount": len(entrypoints),
        "splitCount": split_count,
        "minSplitSize": MIN_SPLIT_SIZE,
        "workflowSeparability": _workflow_separability(entrypoints),
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


def _flow_groups(cluster: dict[str, Any], preprocessed_index: dict[str, dict[str, Any]]) -> dict[str, list[str]]:
    grouped: dict[str, list[str]] = defaultdict(list)
    for conv_id in _string_list(cluster.get("member_conv_ids")):
        conversation = preprocessed_index.get(conv_id, {})
        ended_status = str(conversation.get("ended_status") or "unknown")
        signal = conversation.get("workflow_signal", cluster.get("workflow_signal"))
        signal_key = _signal_key(signal if isinstance(signal, dict) else {})
        grouped[f"{ended_status}:{signal_key}"].append(conv_id)
    if len(grouped) <= 1:
        return dict(grouped)
    major_groups = {key: value for key, value in grouped.items() if len(value) >= MIN_SPLIT_SIZE}
    if len(major_groups) <= 1:
        return {"mixed_flow": [conv_id for values in grouped.values() for conv_id in values]}
    residual = [conv_id for key, values in grouped.items() if key not in major_groups for conv_id in values]
    if residual:
        major_groups["mixed_residual"] = residual
    return major_groups


def _merged_workflow_signal(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
    fallback_signal: object,
) -> dict[str, bool]:
    keys: set[str] = set()
    if isinstance(fallback_signal, dict):
        keys.update(str(key) for key in fallback_signal)
    for conv_id in member_ids:
        signal = preprocessed_index.get(conv_id, {}).get("workflow_signal")
        if isinstance(signal, dict):
            keys.update(str(key) for key in signal)
    output: dict[str, bool] = {}
    for key in sorted(keys):
        fallback_value = isinstance(fallback_signal, dict) and fallback_signal.get(key) is True
        output[key] = (
            any(
                isinstance((signal := preprocessed_index.get(conv_id, {}).get("workflow_signal")), dict)
                and signal.get(key) is True
                for conv_id in member_ids
            )
            or fallback_value
        )
    return output


def _workflow_separability(entrypoints: list[dict[str, Any]]) -> float:
    if not entrypoints:
        return 0.0
    mixed_count = sum(1 for entrypoint in entrypoints if entrypoint.get("splitReason") == "mixed_flow")
    return 1.0 - (mixed_count / len(entrypoints))


def _signal_key(signal: dict[object, object]) -> str:
    enabled = sorted(str(key) for key, value in signal.items() if value is True)
    return "+".join(enabled) if enabled else "no_signal"


def _entrypoint(cluster: dict[str, Any], split_reason: str) -> dict[str, Any]:
    return {
        "entryPointId": cluster["workflow_entrypoint_id"],
        "intentClusterId": cluster["cluster_id"],
        "sourceClusterId": cluster.get("source_cluster_id"),
        "memberConversationIds": _string_list(cluster.get("member_conv_ids")),
        "exemplarConversationIds": _string_list(cluster.get("exemplar_conv_ids")),
        "splitReason": split_reason,
        "confidence": _confidence(cluster),
    }


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


def _read_preprocessed_index(
    runtime_config: PipelineRuntimeConfig,
    stage_context: StageContext,
) -> dict[str, dict[str, Any]]:
    payload = _read_json(_upstream_stage_dir("preprocessing", runtime_config, stage_context) / "preprocessed_data.json")
    conversations = payload.get("conversations")
    if not isinstance(conversations, list):
        return {}
    return {str(item["id"]): item for item in conversations if isinstance(item, dict) and "id" in item}


def _upstream_stage_dir(stage_name: str, runtime_config: PipelineRuntimeConfig, stage_context: StageContext) -> Path:
    upstream = StageContext(
        dag_id=stage_context.dag_id,
        run_id=stage_context.run_id,
        stage_name=stage_name,
        workspace_id=stage_context.workspace_id,
        dataset_id=stage_context.dataset_id,
        pipeline_job_id=stage_context.pipeline_job_id,
    )
    return upstream.artifact_dir(runtime_config)


def _read_json(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PipelineStageError(f"Failed to read JSON artifact: {path}") from exc
    if not isinstance(payload, dict):
        raise PipelineStageError(f"JSON artifact must be an object: {path}")
    return cast(dict[str, Any], payload)


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value]


__all__ = ["run"]
