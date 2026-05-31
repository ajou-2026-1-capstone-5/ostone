from __future__ import annotations

import json
import os
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, cast

import numpy as np

from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineStageError

from .constants import (
    ACTION_OBJECT_SPLIT_PREFIX,
    ACTION_SPLIT_PREFIX,
    COMPOUND_SPLIT_SEPARATOR,
    EXPANDED_MIN_SPLIT_SIZE,
    FLOW_EVENT_LABELS,
    LOW_QUALITY_CLUSTER_DROP_RATIO,
    MIN_SPLIT_SIZE,
    SEQUENCE_SPLIT_PREFIX,
)

def _resolve_expanded_min_split_size(min_split_size: int) -> int:
    value = os.getenv("PIPELINE_FLOW_EXPANDED_MIN_SPLIT_SIZE", "").strip()
    if value:
        try:
            parsed = int(value)
        except ValueError:
            parsed = EXPANDED_MIN_SPLIT_SIZE
    else:
        parsed = EXPANDED_MIN_SPLIT_SIZE
    return max(2, min(parsed, min_split_size))

def _member_index_lookup(
    runtime_config: PipelineRuntimeConfig,
    stage_context: StageContext,
    clusters_payload: dict[str, Any],
) -> dict[str, int]:
    lookup = _representation_member_index_lookup(runtime_config, stage_context)
    if lookup:
        return lookup
    for cluster in clusters_payload.get("clusters", []):
        if not isinstance(cluster, dict):
            continue
        member_ids = _string_list(cluster.get("member_conv_ids"))
        member_indices = _int_list(cluster.get("member_indices"))
        if len(member_ids) != len(member_indices):
            continue
        for member_id, member_index in zip(member_ids, member_indices):
            lookup.setdefault(member_id, member_index)
    return lookup

def _representation_member_index_lookup(
    runtime_config: PipelineRuntimeConfig,
    stage_context: StageContext,
) -> dict[str, int]:
    index_path = _upstream_stage_dir("representation", runtime_config, stage_context) / "embedding_index.json"
    if not index_path.exists():
        return {}
    try:
        payload = json.loads(index_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if not isinstance(payload, list):
        return {}
    output: dict[str, int] = {}
    for item in payload:
        if not isinstance(item, dict):
            continue
        conversation_id = item.get("conversationId")
        row_index = item.get("rowIndex")
        embedding_success = item.get("embeddingSuccess")
        if isinstance(conversation_id, str) and isinstance(row_index, int) and embedding_success is True:
            output[conversation_id] = row_index
    return output

def _member_indices_for_ids(
    member_ids: list[str],
    member_index_lookup: dict[str, int],
    fallback: list[int] | None = None,
) -> list[int]:
    indices = [member_index_lookup[member_id] for member_id in member_ids if member_id in member_index_lookup]
    if indices:
        return indices
    return list(fallback or [])

def _merge_duplicate_intent_labels(
    clusters: list[object],
    preprocessed_index: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for cluster in clusters:
        if not isinstance(cluster, dict):
            continue
        cluster_key = _cluster_compaction_key(cluster)
        if cluster_key not in merged:
            copied = dict(cluster)
            source_cluster_id = copied.get("cluster_id")
            copied["source_cluster_ids"] = [source_cluster_id] if source_cluster_id is not None else []
            merged[cluster_key] = copied
            continue
        target = merged[cluster_key]
        _extend_unique(target, "member_conv_ids", _string_list(cluster.get("member_conv_ids")))
        _extend_unique_int(target, "member_indices", _int_list(cluster.get("member_indices")))
        _extend_unique(target, "exemplar_conv_ids", _string_list(cluster.get("exemplar_conv_ids")), limit=5)
        _extend_unique(target, "keywords", _string_list(cluster.get("keywords")), limit=12)
        source_cluster_id = cluster.get("cluster_id")
        if source_cluster_id is not None:
            sources = target.setdefault("source_cluster_ids", [])
            if isinstance(sources, list) and source_cluster_id not in sources:
                sources.append(source_cluster_id)
        target["cluster_size"] = len(_string_list(target.get("member_conv_ids")))
        target["workflow_signal"] = _merged_workflow_signal(
            _string_list(target.get("member_conv_ids")),
            preprocessed_index,
            target.get("workflow_signal"),
        )
        target["quality"] = _merge_quality(target.get("quality"), cluster.get("quality"))
    return list(merged.values())

def _drop_low_quality_clusters(
    clusters: list[dict[str, Any]],
    preprocessed_index: dict[str, dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, int | float]]:
    kept: list[dict[str, Any]] = []
    dropped_count = 0
    dropped_members = 0
    for cluster in clusters:
        member_ids = _string_list(cluster.get("member_conv_ids"))
        low_quality_ratio = _low_quality_member_ratio(member_ids, preprocessed_index)
        if member_ids and low_quality_ratio >= LOW_QUALITY_CLUSTER_DROP_RATIO:
            dropped_count += 1
            dropped_members += len(member_ids)
            continue
        copied = dict(cluster)
        copied["low_quality_member_ratio"] = low_quality_ratio
        kept.append(copied)
    return kept, {
        "qualityFilteredClusterCount": len(kept),
        "droppedLowQualityClusterCount": dropped_count,
        "droppedLowQualityMemberCount": dropped_members,
        "lowQualityClusterDropRatio": LOW_QUALITY_CLUSTER_DROP_RATIO,
    }

def _cluster_member_id_set(clusters: list[dict[str, Any]]) -> set[str]:
    output: set[str] = set()
    for cluster in clusters:
        output.update(_string_list(cluster.get("member_conv_ids")))
    return output

def _int_from_mapping(value: object, key: str) -> int:
    if not isinstance(value, dict):
        return 0
    raw_value = value.get(key)
    if isinstance(raw_value, bool):
        return 0
    if isinstance(raw_value, int):
        return raw_value
    if isinstance(raw_value, float):
        return int(raw_value)
    return 0

def _low_quality_member_ratio(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> float:
    if not member_ids:
        return 0.0
    low_quality_count = 0
    for conv_id in member_ids:
        row = preprocessed_index.get(conv_id)
        if not isinstance(row, dict):
            continue
        quality_score = row.get("quality_score")
        quality_tier = str(row.get("quality_tier") or "").upper()
        if (
            row.get("filtered") is True
            or quality_tier in {"C", "D"}
            or (isinstance(quality_score, (int, float)) and not isinstance(quality_score, bool) and quality_score < 0.8)
        ):
            low_quality_count += 1
    return low_quality_count / len(member_ids)

def _cluster_compaction_key(cluster: dict[str, Any]) -> str:
    root_domain = str(cluster.get("root_domain") or "")
    name = str(cluster.get("canonical_intent") or cluster.get("suggested_name") or "").strip().casefold()
    return f"{root_domain}:{name}" if name else f"cluster:{cluster.get('cluster_id')}"

def _extend_unique(
    target: dict[str, Any],
    key: str,
    values: list[str],
    limit: int | None = None,
) -> None:
    items = target.setdefault(key, [])
    if not isinstance(items, list):
        items = []
        target[key] = items
    for value in values:
        if value not in items:
            items.append(value)
        if limit is not None and len(items) >= limit:
            break

def _extend_unique_int(
    target: dict[str, Any],
    key: str,
    values: list[int],
) -> None:
    items = target.setdefault(key, [])
    if not isinstance(items, list):
        items = []
        target[key] = items
    for value in values:
        if value not in items:
            items.append(value)

def _merge_quality(left: object, right: object) -> dict[str, float]:
    if not isinstance(left, dict):
        left = {}
    if not isinstance(right, dict):
        right = {}
    output: dict[str, float] = {}
    for key in ("interpretability_score", "workflow_consistency_score", "branching_explainability_score"):
        values = [
            float(value)
            for value in (left.get(key), right.get(key))
            if isinstance(value, (int, float)) and not isinstance(value, bool)
        ]
        if values:
            output[key] = sum(values) / len(values)
    return output

def _event_sequence_key(conversation: object, max_events: int = 3) -> str:
    if not isinstance(conversation, dict):
        return f"{SEQUENCE_SPLIT_PREFIX}unknown"
    raw_events = conversation.get("flow_events")
    if not isinstance(raw_events, list):
        return f"{SEQUENCE_SPLIT_PREFIX}unknown"
    events = _collapsed_events([str(event) for event in raw_events if isinstance(event, str)])
    if not events:
        return f"{SEQUENCE_SPLIT_PREFIX}unknown"
    return f"{SEQUENCE_SPLIT_PREFIX}{'>'.join(events[:max_events])}"

def _collapsed_events(events: list[str]) -> list[str]:
    output: list[str] = []
    for event in events:
        if event and (not output or output[-1] != event):
            output.append(event)
    return output

def _flow_group_key(ended_status: str, signal_key: str) -> str:
    if ended_status in {"resolved", "escalated"}:
        return f"{ended_status}:{signal_key}"
    return signal_key

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
    has_member_signal = any(
        isinstance(preprocessed_index.get(conv_id, {}).get("workflow_signal"), dict) for conv_id in member_ids
    )
    for key in sorted(keys):
        fallback_value = isinstance(fallback_signal, dict) and fallback_signal.get(key) is True
        member_value = any(
            isinstance((signal := preprocessed_index.get(conv_id, {}).get("workflow_signal")), dict)
            and signal.get(key) is True
            for conv_id in member_ids
        )
        output[key] = member_value if has_member_signal else fallback_value
    return output

def _signal_key(signal: dict[object, object]) -> str:
    enabled = sorted(str(key) for key, value in signal.items() if value is True)
    return "+".join(enabled) if enabled else "no_signal"

def _split_name(base_name: str, split_key: str) -> str:
    label = _split_label(split_key)
    if label == "기본 처리":
        return base_name
    return f"{base_name} - {label}"

def _split_label(split_key: str) -> str:
    if COMPOUND_SPLIT_SEPARATOR in split_key:
        parts = [_split_label(part) for part in split_key.split(COMPOUND_SPLIT_SEPARATOR) if part]
        parts = [part for part in parts if part and part != "기본 처리"]
        return " · ".join(parts[:3]) if parts else "기본 처리"
    signal_key = split_key.split(":", 1)[1] if ":" in split_key else split_key
    if split_key == "mixed_residual":
        return "기타 처리 흐름"
    if split_key.startswith(ACTION_OBJECT_SPLIT_PREFIX):
        return _action_object_split_label(split_key)
    if split_key.startswith(ACTION_SPLIT_PREFIX):
        return _action_split_label(split_key)
    if split_key.startswith(SEQUENCE_SPLIT_PREFIX):
        return _sequence_split_label(split_key)
    labels: list[str] = []
    if "requires_user_identification" in signal_key:
        labels.append("본인확인 필요")
    if "requires_payment_check" in signal_key:
        labels.append("결제확인 필요")
    if split_key.startswith("escalated:") or "has_escalation_cases" in signal_key:
        labels.append("상담원 이관 포함")
    return " · ".join(labels) if labels else "기본 처리"

def _sequence_split_label(split_key: str) -> str:
    raw_sequence = split_key.removeprefix(SEQUENCE_SPLIT_PREFIX)
    labels = [FLOW_EVENT_LABELS.get(event, event) for event in raw_sequence.split(">") if event]
    if not labels or labels == ["unknown"]:
        return "관측 흐름 분리"
    return " · ".join(labels[:3]) + " 흐름"

def _action_object_split_label(split_key: str) -> str:
    raw = split_key.removeprefix(ACTION_OBJECT_SPLIT_PREFIX)
    if ">" not in raw:
        return "요청 대상 분리"
    object_term, action = raw.split(">", 1)
    object_term = object_term.strip()
    action = action.strip()
    if object_term and action:
        return f"{object_term} {action} 기준"
    return "요청 대상 분리"

def _action_split_label(split_key: str) -> str:
    action = split_key.removeprefix(ACTION_SPLIT_PREFIX).strip()
    return f"{action} 처리" if action else "요청 유형 분리"

def _split_reason_has_sequence(split_reason: str) -> bool:
    return any(part.startswith(SEQUENCE_SPLIT_PREFIX) for part in split_reason.split(COMPOUND_SPLIT_SEPARATOR))

def _split_reason_has_action_object(split_reason: str) -> bool:
    return any(part.startswith(ACTION_OBJECT_SPLIT_PREFIX) for part in split_reason.split(COMPOUND_SPLIT_SEPARATOR))

def _split_reason_has_action(split_reason: str) -> bool:
    return any(part.startswith(ACTION_SPLIT_PREFIX) for part in split_reason.split(COMPOUND_SPLIT_SEPARATOR))

def _l2norm(vectors: np.ndarray) -> np.ndarray:
    values = vectors.astype(np.float32, copy=True)
    if values.size == 0:
        return values
    norms = np.linalg.norm(values, axis=1, keepdims=True)
    normalized = np.zeros_like(values, dtype=np.float32)
    _ = np.divide(values, norms, out=normalized, where=norms > 0.0)
    return normalized.astype(np.float32, copy=False)

def _dominant_sequence_share(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> float:
    counts: Counter[str] = Counter()
    for conv_id in member_ids:
        counts[_event_sequence_key(preprocessed_index.get(conv_id), max_events=3)] += 1
    if not counts:
        return 0.0
    return counts.most_common(1)[0][1] / len(member_ids)

def _dominant_signal_share(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
) -> float:
    counts: Counter[str] = Counter()
    for conv_id in member_ids:
        row = preprocessed_index.get(conv_id, {})
        signal = row.get("workflow_signal") if isinstance(row, dict) else {}
        counts[_signal_key(signal if isinstance(signal, dict) else {})] += 1
    if not counts:
        return 0.0
    return counts.most_common(1)[0][1] / len(member_ids)

def _is_mixed_residual_reason(split_reason: str) -> bool:
    return split_reason in {"mixed_flow", "mixed_residual"} or split_reason.endswith(
        f"{COMPOUND_SPLIT_SEPARATOR}mixed_residual"
    )

def _total_member_count(clusters: list[dict[str, Any]]) -> int:
    return sum(len(_string_list(cluster.get("member_conv_ids"))) for cluster in clusters)

def _workflow_label(cluster: dict[str, Any]) -> str:
    return str(cluster.get("canonical_intent") or cluster.get("suggested_name") or "").strip().casefold()

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

def _float_value(value: object, *, default: float) -> float:
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else default

def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))

def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        output.append(value)
    return output

def _read_preprocessed_index(
    runtime_config: PipelineRuntimeConfig,
    stage_context: StageContext,
) -> dict[str, dict[str, Any]]:
    payload = _read_json(_upstream_stage_dir("preprocessing", runtime_config, stage_context) / "preprocessed_data.json")
    conversations = payload.get("conversations")
    if not isinstance(conversations, list):
        return {}
    index = {str(item["id"]): item for item in conversations if isinstance(item, dict) and "id" in item}
    caselets = payload.get("issueCaselets")
    if isinstance(caselets, list):
        for caselet in caselets:
            if isinstance(caselet, dict) and isinstance(caselet.get("caseletId"), str):
                index[str(caselet["caseletId"])] = {
                    "id": caselet.get("caseletId", ""),
                    "source_conversation_id": caselet.get("conversationId"),
                    "canonical_text": caselet.get("canonicalText", ""),
                    "customer_problem_text": caselet.get("customerIssueText", ""),
                    "ended_status": caselet.get("outcome"),
                    "flow_events": caselet.get("flowEvents", []),
                    "turn_event_details": caselet.get("turnEventDetails", []),
                    "workflow_signal": caselet.get("workflowSignal", {}),
                    "source_quality_flags": caselet.get("sourceQualityFlags", []),
                    "filtered": caselet.get("filtered") is True,
                    "quality_score": caselet.get("qualityScore"),
                    "quality_tier": caselet.get("qualityTier"),
                    "evidence_turn_ids": caselet.get("evidenceTurnIds", []),
                    "action_object_frame": caselet.get("actionObjectFrame", {}),
                }
    return index

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

def _int_list(value: object) -> list[int]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, int) and not isinstance(item, bool)]
