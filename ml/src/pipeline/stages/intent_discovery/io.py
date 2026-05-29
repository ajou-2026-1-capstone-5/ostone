from __future__ import annotations

# pyright: reportMissingTypeStubs=false, reportUnknownMemberType=false, reportAny=false
import json
import os
from collections.abc import Mapping
from dataclasses import asdict
from pathlib import Path
from typing import TypeGuard, cast

import numpy as np

from pipeline.common.artifacts import ensure_stage_directory, write_stage_manifest
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineStageError
from pipeline.stages.intent_discovery.types import (
    FLOW_SIGNATURE_DIM,
    ClusterQuality,
    ClusterResult,
    IntentDiscoveryStats,
    NovelIntentCandidate,
    ProcessedConversation,
)

DEFAULT_PREPROCESSED_ARTIFACT = "preprocessed_data.json"
DEFAULT_CLUSTER_ARTIFACT = "clusters.json"
DEFAULT_EMBEDDING_ARTIFACT = "embeddings.npy"


def read_preprocessed_artifact(
    runtime_config: PipelineRuntimeConfig,
    context: StageContext,
) -> tuple[list[ProcessedConversation], np.ndarray]:
    artifact_path = _preprocessing_dir(runtime_config, context) / DEFAULT_PREPROCESSED_ARTIFACT
    if not artifact_path.exists():
        raise PipelineStageError(f"Preprocessed artifact does not exist: {artifact_path}")

    try:
        payload = json.loads(artifact_path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise PipelineStageError(f"Failed to read preprocessed artifact: {artifact_path}") from exc
    except json.JSONDecodeError as exc:
        raise PipelineStageError(f"Invalid preprocessed artifact JSON: {artifact_path}") from exc

    conversations = _build_analysis_units(payload, artifact_path)
    flow_signatures = np.asarray([conversation.flow_signature for conversation in conversations], dtype=np.float32)
    return conversations, flow_signatures.reshape((len(conversations), FLOW_SIGNATURE_DIM))


def _build_analysis_units(payload: object, artifact_path: Path) -> list[ProcessedConversation]:
    analysis_unit = os.getenv("PIPELINE_ANALYSIS_UNIT", "caselet").strip().lower()
    if analysis_unit == "caselet":
        caselets = _build_caselet_conversations(payload, artifact_path)
        if caselets is not None:
            return caselets
    return [
        conversation
        for conversation in _build_processed_conversations(payload, artifact_path)
        if not conversation.filtered
    ]


def write_clusters_artifact(
    runtime_config: PipelineRuntimeConfig,
    context: StageContext,
    clusters: list[ClusterResult],
    novel_candidates: list[NovelIntentCandidate],
    stats: IntentDiscoveryStats,
    embeddings: np.ndarray,
    extra_manifest_payload: Mapping[str, object] | None = None,
    extra_output_payload: Mapping[str, object] | None = None,
) -> Path:
    output_dir = ensure_stage_directory(context, runtime_config)
    clusters_path = output_dir / DEFAULT_CLUSTER_ARTIFACT
    embeddings_path = output_dir / DEFAULT_EMBEDDING_ARTIFACT

    output: dict[str, object] = {
        "schema_version": "1.0",
        "stage": "intent_discovery",
        "clusters": [_serialize_cluster(cluster) for cluster in clusters],
        "novel_candidates": [_serialize_novel_candidate(candidate) for candidate in novel_candidates],
        "stats": _serialize_stats(stats),
        "embeddings_path": embeddings_path.name,
    }
    if extra_output_payload is not None:
        output.update(extra_output_payload)

    _ = clusters_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    np.save(embeddings_path, embeddings.astype(np.float32, copy=False))
    manifest_payload: dict[str, object] = {
        "artifact_path": clusters_path.name,
        "embeddings_path": embeddings_path.name,
    }
    if extra_manifest_payload is not None:
        manifest_payload.update(extra_manifest_payload)

    _ = write_stage_manifest(context, runtime_config, manifest_payload)
    return clusters_path


def _preprocessing_dir(runtime_config: PipelineRuntimeConfig, context: StageContext) -> Path:
    upstream_context = StageContext(
        dag_id=context.dag_id,
        run_id=context.run_id,
        stage_name="preprocessing",
        workspace_id=context.workspace_id,
        dataset_id=context.dataset_id,
        pipeline_job_id=context.pipeline_job_id,
    )
    return upstream_context.artifact_dir(runtime_config)


def _build_processed_conversations(payload: object, artifact_path: Path) -> list[ProcessedConversation]:
    if not _is_json_object(payload):
        raise PipelineStageError(f"Preprocessed artifact must be a JSON object: {artifact_path}")

    conversations_payload = payload.get("conversations")
    if not _is_object_list(conversations_payload):
        raise PipelineStageError(f"Preprocessed artifact conversations must be a list: {artifact_path}")

    return [_build_processed_conversation(item, artifact_path) for item in conversations_payload]


def _build_processed_conversation(payload: object, artifact_path: Path) -> ProcessedConversation:
    if not _is_json_object(payload):
        raise PipelineStageError(f"Processed conversation must be a JSON object: {artifact_path}")

    flow_signature = _build_flow_signature(payload.get("flow_signature"), artifact_path)
    flow_signature_dim = _required_int(payload, "flow_signature_dim", artifact_path)
    if flow_signature_dim != len(flow_signature):
        raise PipelineStageError(
            f"flow_signature_dim ({flow_signature_dim}) must match "
            f"flow_signature length ({len(flow_signature)}): {artifact_path}"
        )
    return ProcessedConversation(
        id=_required_str(payload, "id", artifact_path),
        dataset_id=_required_str(payload, "dataset_id", artifact_path),
        channel=_optional_str(payload.get("channel")),
        ended_status=_optional_str(payload.get("ended_status")),
        metadata=_optional_metadata(payload.get("metadata")),
        canonical_text=_required_str(payload, "canonical_text", artifact_path),
        customer_problem_text=_required_str(payload, "customer_problem_text", artifact_path),
        flow_signature=flow_signature,
        flow_signature_dim=flow_signature_dim,
        turn_count=_required_int(payload, "turn_count", artifact_path),
        customer_turn_count=_required_int(payload, "customer_turn_count", artifact_path),
        pii_mask_count=_required_int(payload, "pii_mask_count", artifact_path),
        filtered=_required_bool(payload, "filtered", artifact_path),
        workflow_signal=_optional_bool_dict(payload.get("workflow_signal"), artifact_path),
        flow_events=_optional_str_tuple(payload.get("flow_events"), artifact_path),
    )


def _build_caselet_conversations(payload: object, artifact_path: Path) -> list[ProcessedConversation] | None:
    if not _is_json_object(payload):
        raise PipelineStageError(f"Preprocessed artifact must be a JSON object: {artifact_path}")
    caselet_payload = payload.get("issueCaselets")
    if caselet_payload is None:
        return None
    if not _is_object_list(caselet_payload):
        raise PipelineStageError(f"Preprocessed artifact issueCaselets must be a list: {artifact_path}")
    output: list[ProcessedConversation] = []
    for item in caselet_payload:
        if not _is_json_object(item):
            raise PipelineStageError(f"Issue caselet must be a JSON object: {artifact_path}")
        if item.get("filtered") is True:
            continue
        output.append(_build_caselet_conversation(item, artifact_path))
    return output


def _build_caselet_conversation(payload: object, artifact_path: Path) -> ProcessedConversation:
    if not _is_json_object(payload):
        raise PipelineStageError(f"Issue caselet must be a JSON object: {artifact_path}")
    flow_signature = _build_flow_signature(payload.get("flowSignature"), artifact_path)
    flow_signature_dim = _required_int(payload, "flowSignatureDim", artifact_path)
    if flow_signature_dim != len(flow_signature):
        raise PipelineStageError(
            f"flowSignatureDim ({flow_signature_dim}) must match "
            f"flowSignature length ({len(flow_signature)}): {artifact_path}"
        )
    source_conversation_id = _required_str(payload, "conversationId", artifact_path)
    turn_start = _required_int(payload, "turnStart", artifact_path)
    turn_end = _required_int(payload, "turnEnd", artifact_path)
    metadata = {
        "sourceConversationId": source_conversation_id,
        "turnStart": turn_start,
        "turnEnd": turn_end,
        "analysisUnit": "caselet",
        "sourceQualityFlags": _optional_str_tuple(payload.get("sourceQualityFlags"), artifact_path),
        "qualityScore": _optional_float(payload.get("qualityScore")),
        "qualityTier": _optional_str(payload.get("qualityTier")),
        "filtered": _required_bool(payload, "filtered", artifact_path),
        "evidenceTurnIds": _optional_str_tuple(payload.get("evidenceTurnIds"), artifact_path),
        "actionObjectFrame": _optional_object(payload.get("actionObjectFrame"), artifact_path),
    }
    return ProcessedConversation(
        id=_required_str(payload, "caseletId", artifact_path),
        dataset_id=_required_str(payload, "datasetId", artifact_path),
        channel=None,
        ended_status=_optional_str(payload.get("outcome")),
        metadata=metadata,
        canonical_text=_required_str(payload, "canonicalText", artifact_path),
        customer_problem_text=_required_str(payload, "customerIssueText", artifact_path),
        flow_signature=flow_signature,
        flow_signature_dim=flow_signature_dim,
        turn_count=max(1, turn_end - turn_start + 1),
        customer_turn_count=1,
        pii_mask_count=_required_int(payload, "piiMaskCount", artifact_path),
        filtered=_required_bool(payload, "filtered", artifact_path),
        workflow_signal=_optional_bool_dict(payload.get("workflowSignal"), artifact_path),
        flow_events=_optional_str_tuple(payload.get("flowEvents"), artifact_path),
    )


def _build_flow_signature(value: object, artifact_path: Path) -> tuple[float, ...]:
    if not _is_object_list(value):
        raise PipelineStageError(f"flow_signature must be a list: {artifact_path}")

    flow_signature = tuple(_required_float(item, artifact_path) for item in value)

    if len(flow_signature) != FLOW_SIGNATURE_DIM:
        raise PipelineStageError(f"flow_signature must have {FLOW_SIGNATURE_DIM} values: {artifact_path}")
    return flow_signature


def _required_str(payload: Mapping[str, object], key: str, artifact_path: Path) -> str:
    value = payload.get(key)
    if isinstance(value, str):
        return value
    raise PipelineStageError(f"Processed conversation field {key!r} must be a string: {artifact_path}")


def _required_int(payload: Mapping[str, object], key: str, artifact_path: Path) -> int:
    value = payload.get(key)
    if isinstance(value, int) and not isinstance(value, bool):
        return value
    raise PipelineStageError(f"Processed conversation field {key!r} must be an integer: {artifact_path}")


def _required_bool(payload: Mapping[str, object], key: str, artifact_path: Path) -> bool:
    value = payload.get(key)
    if isinstance(value, bool):
        return value
    raise PipelineStageError(f"Processed conversation field {key!r} must be a boolean: {artifact_path}")


def _required_float(value: object, artifact_path: Path) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise PipelineStageError(f"flow_signature must contain only numbers: {artifact_path}")
    return float(value)


def _optional_str(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    raise PipelineStageError(f"Optional field must be a string or null, got {type(value).__name__}")


def _optional_bool_dict(value: object, artifact_path: Path) -> dict[str, bool]:
    if value is None:
        return {}
    if not isinstance(value, Mapping):
        raise PipelineStageError(f"workflow_signal must be an object when present: {artifact_path}")
    output: dict[str, bool] = {}
    for key, item in value.items():
        if not isinstance(key, str):
            raise PipelineStageError(f"workflow_signal keys must be strings: {artifact_path}")
        if not isinstance(item, bool):
            raise PipelineStageError(f"workflow_signal values must be booleans: {artifact_path}")
        output[key] = item
    return output


def _optional_str_tuple(value: object, artifact_path: Path) -> tuple[str, ...]:
    if value is None:
        return ()
    if not isinstance(value, list):
        raise PipelineStageError(f"flow_events must be a list when present: {artifact_path}")
    output: list[str] = []
    for item in value:
        if not isinstance(item, str):
            raise PipelineStageError(f"flow_events values must be strings: {artifact_path}")
        if item:
            output.append(item)
    return tuple(output)


def _optional_float(value: object) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    return None


def _optional_metadata(value: object) -> dict[str, object]:
    if not isinstance(value, Mapping):
        return {}
    return {str(key): item for key, item in value.items() if _metadata_value_allowed(item)}


def _metadata_value_allowed(value: object) -> bool:
    return value is None or isinstance(value, str | int | float | bool)


def _optional_object(value: object, artifact_path: Path) -> dict[str, object]:
    if value is None:
        return {}
    if not isinstance(value, Mapping):
        raise PipelineStageError(f"Optional object field must be an object: {artifact_path}")
    return {str(key): item for key, item in value.items() if _metadata_value_allowed(item)}


def _serialize_cluster(cluster: ClusterResult) -> dict[str, object]:
    output: dict[str, object] = {
        "cluster_id": cluster.cluster_id,
        "member_indices": list(cluster.member_indices),
        "member_conv_ids": list(cluster.member_conv_ids),
        "exemplar_conv_ids": list(cluster.exemplar_conv_ids),
        "keywords": list(cluster.keywords),
        "suggested_name": cluster.suggested_name,
        "suggested_description": cluster.suggested_description,
        "workflow_signal": cluster.workflow_signal,
        "quality": _serialize_quality(cluster.quality),
        "review_hint": cluster.review_hint,
    }
    if cluster.metadata is not None:
        output.update(cluster.metadata)
    return output


def _serialize_quality(quality: ClusterQuality) -> dict[str, float | None]:
    return {
        "interpretability_score": quality.interpretability_score,
        "workflow_consistency_score": quality.workflow_consistency_score,
        "branching_explainability_score": quality.branching_explainability_score,
    }


def _serialize_novel_candidate(candidate: NovelIntentCandidate) -> dict[str, object]:
    return {
        "candidate_key": candidate.candidate_key,
        "source_type": candidate.source_type,
        "candidate_size": candidate.candidate_size,
        "suggested_name": candidate.suggested_name,
        "member_conv_ids": list(candidate.member_conv_ids),
    }


def _serialize_stats(stats: IntentDiscoveryStats) -> dict[str, object]:
    return cast(dict[str, object], asdict(stats))


def _is_json_object(value: object) -> TypeGuard[Mapping[str, object]]:
    return isinstance(value, Mapping)


def _is_object_list(value: object) -> TypeGuard[list[object]]:
    return isinstance(value, list)


__all__ = [
    "DEFAULT_CLUSTER_ARTIFACT",
    "DEFAULT_EMBEDDING_ARTIFACT",
    "DEFAULT_PREPROCESSED_ARTIFACT",
    "read_preprocessed_artifact",
    "write_clusters_artifact",
]
