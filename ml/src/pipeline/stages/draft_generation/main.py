from __future__ import annotations

import json
import logging
import os
import re
import time
from collections.abc import Iterable
from pathlib import Path
from typing import Any, NamedTuple

from pipeline.common.artifacts import ensure_stage_directory, write_stage_manifest
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineStageError
from pipeline.common.logging import get_stage_logger
from pipeline.stages.draft_generation.workflow_evidence import (
    build_workflow_evidence,
    serialize_evidence_json,
)
from pipeline.stages.draft_generation.workflow_graph import (
    DUMMY_POLICY_CODE,
    ClusterContext,
    serialize_graph_json,
    signal_based_generator,
)
from pipeline.stages.preprocessing.io import read_stage_context

_logger = logging.getLogger("pipeline.draft_generation")

DEFAULT_CANDIDATE_ARTIFACT = "candidate.json"
DEFAULT_CLUSTERS_ARTIFACT = "clusters.json"
DEFAULT_PREPROCESSED_ARTIFACT = "preprocessed_data.json"
DEFAULT_SEGMENT_ARTIFACT = "intent_segments_v3.jsonl"
INTENT_MISC = "기타 문의"


class SlotTemplate(NamedTuple):
    code_suffix: str
    name: str
    description: str
    data_type: str
    is_sensitive: bool


SIGNAL_SLOT_MAPPING: dict[str, tuple[SlotTemplate, ...]] = {
    "requires_payment_check": (
        SlotTemplate("order_id", "주문 ID", "결제·환불 대상 주문 식별자", "STRING", False),
        SlotTemplate("payment_method", "결제 수단", "결제 수단 (카드/계좌이체 등)", "STRING", False),
    ),
    "requires_user_identification": (
        SlotTemplate("customer_name", "고객 이름", "본인 확인용 고객 이름", "STRING", True),
        SlotTemplate("customer_phone", "고객 연락처", "본인 확인용 휴대폰 번호", "STRING", True),
    ),
    "has_escalation_cases": (
        SlotTemplate("escalation_reason", "에스컬레이션 사유", "상담사 전환 사유", "STRING", False),
    ),
}


def run(upstream_manifest_path: str | None = None) -> dict[str, object]:
    start = time.monotonic()
    runtime_config = PipelineRuntimeConfig.from_env()
    stage_context = read_stage_context(upstream_manifest_path, stage_name="draft_generation")
    logger = get_stage_logger(stage_context)

    logger.info("draft_generation.start %s", stage_context)

    clusters_payload = _read_clusters(runtime_config, stage_context)
    clusters = clusters_payload.get("clusters") or []
    logger.info("draft_generation.cluster_loaded cluster_count=%d", len(clusters))

    preprocessed_index = _read_preprocessed_index(runtime_config, stage_context)
    logger.info("draft_generation.preprocessed_loaded conversation_count=%d", len(preprocessed_index))

    segment_rows = _read_segment_rows(runtime_config, stage_context)
    consultation_cluster_groups = _build_consultation_cluster_groups(clusters, segment_rows)
    if consultation_cluster_groups:
        logger.info(
            "draft_generation.consultation_split consultation_count=%d",
            len(consultation_cluster_groups),
        )

    cases_per_intent = _resolve_cases_per_intent()
    candidate, metrics = _build_candidate_artifact(
        consultation_cluster_groups or {"": clusters},
        preprocessed_index,
        cases_per_intent,
        stage_context,
    )
    intent_metrics = metrics["intent_metrics"]
    logger.info(
        "draft_generation.intent_built candidate_count=%d intent_count=%d representative_case_total=%d "
        "intents_with_zero_cases=%d",
        metrics["candidate_count"],
        intent_metrics["intent_count"],
        intent_metrics["representative_case_total"],
        intent_metrics["intents_with_zero_cases"],
    )
    workflow_metrics = metrics["workflow_metrics"]
    logger.info(
        "draft_generation.workflow_summary workflow_count=%d identify_count=%d payment_count=%d escalation_count=%d"
        " evidence_keyword_total=%d evidence_exemplar_total=%d evidence_member_total=%d empty_evidence_count=%d",
        workflow_metrics["workflow_count"],
        workflow_metrics["workflow_with_identify_count"],
        workflow_metrics["workflow_with_payment_check_count"],
        workflow_metrics["workflow_with_escalation_count"],
        workflow_metrics["workflow_evidence_keyword_total"],
        workflow_metrics["workflow_evidence_exemplar_total"],
        workflow_metrics["workflow_evidence_member_total"],
        workflow_metrics["workflow_with_empty_evidence_count"],
    )

    slot_metrics = metrics["slot_metrics"]
    logger.info(
        "draft_generation.slot_summary slot_count=%d cluster_with_slot_count=%d "
        "signal_slot_hit_payment_check=%d signal_slot_hit_user_identification=%d "
        "signal_slot_hit_escalation=%d",
        slot_metrics["slot_count"],
        slot_metrics["cluster_with_slot_count"],
        slot_metrics["signal_slot_hit_payment_check"],
        slot_metrics["signal_slot_hit_user_identification"],
        slot_metrics["signal_slot_hit_escalation"],
    )
    logger.info(
        "draft_generation.pack_identity candidate_count=%d",
        metrics["candidate_count"],
    )

    candidate_path = _write_candidate(stage_context, runtime_config, candidate)

    manifest_metrics = _flatten_metrics(metrics)
    manifest_metrics["processing_duration_seconds"] = time.monotonic() - start

    manifest = write_stage_manifest(
        stage_context,
        runtime_config,
        {"candidateArtifactPath": candidate_path.name, "metrics": manifest_metrics},
    )

    logger.info("draft_generation.completed candidate_artifact_path=%s", candidate_path)
    return {"candidateArtifactPath": str(candidate_path), "artifact_manifest_path": str(manifest)}


def _read_clusters(runtime_config: PipelineRuntimeConfig, stage_context: StageContext) -> dict[str, Any]:
    clusters_path = _upstream_stage_dir("intent_discovery", runtime_config, stage_context) / DEFAULT_CLUSTERS_ARTIFACT
    if not clusters_path.exists():
        raise PipelineStageError(f"clusters.json not found: {clusters_path}")
    try:
        payload = json.loads(clusters_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PipelineStageError(f"Failed to read clusters.json: {clusters_path}") from exc
    if not isinstance(payload, dict):
        raise PipelineStageError(f"clusters.json must be a JSON object: {clusters_path}")
    return payload


def _read_preprocessed_index(
    runtime_config: PipelineRuntimeConfig,
    stage_context: StageContext,
) -> dict[str, dict[str, Any]]:
    preprocessed_path = (
        _upstream_stage_dir("preprocessing", runtime_config, stage_context) / DEFAULT_PREPROCESSED_ARTIFACT
    )
    if not preprocessed_path.exists():
        raise PipelineStageError(f"preprocessed_data.json not found: {preprocessed_path}")
    try:
        data = json.loads(preprocessed_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PipelineStageError(f"Failed to read preprocessed_data.json: {preprocessed_path}") from exc
    if not isinstance(data, dict):
        raise PipelineStageError(f"preprocessed_data.json must be a JSON object: {preprocessed_path}")
    conversations = data.get("conversations")
    if not isinstance(conversations, list):
        raise PipelineStageError(f"preprocessed_data.json conversations must be a list: {preprocessed_path}")
    return {conv["id"]: conv for conv in conversations if isinstance(conv, dict) and "id" in conv}


def _read_segment_rows(
    runtime_config: PipelineRuntimeConfig,
    stage_context: StageContext,
) -> list[dict[str, Any]]:
    segment_path = _upstream_stage_dir("intent_discovery", runtime_config, stage_context) / DEFAULT_SEGMENT_ARTIFACT
    if not segment_path.exists():
        return []

    rows: list[dict[str, Any]] = []
    try:
        for line_number, line in enumerate(segment_path.read_text(encoding="utf-8").splitlines(), start=1):
            line = line.strip()
            if not line:
                continue
            payload = json.loads(line)
            if not isinstance(payload, dict):
                raise PipelineStageError(f"{DEFAULT_SEGMENT_ARTIFACT} line {line_number} must be a JSON object.")
            rows.append(payload)
    except OSError as exc:
        raise PipelineStageError(f"Failed to read {DEFAULT_SEGMENT_ARTIFACT}: {segment_path}") from exc
    except json.JSONDecodeError as exc:
        raise PipelineStageError(f"Invalid JSONL in {DEFAULT_SEGMENT_ARTIFACT}: {segment_path}") from exc
    return rows


def _build_consultation_cluster_groups(
    clusters: list[Any],
    segment_rows: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    if not segment_rows:
        return {}

    global_by_canonical, global_by_cluster_id = _build_global_cluster_index(clusters)
    grouped = _group_segment_rows_by_consultation(segment_rows)
    consultation_clusters: dict[str, list[dict[str, Any]]] = {}
    for consultation_id, canonical_groups in grouped.items():
        consultation_clusters[consultation_id] = [
            _build_local_consultation_cluster(
                local_cluster_id,
                consultation_id,
                canonical,
                rows,
                global_by_canonical,
                global_by_cluster_id,
            )
            for local_cluster_id, (canonical, rows) in enumerate(canonical_groups.items())
        ]
    return consultation_clusters


def _build_global_cluster_index(
    clusters: list[Any],
) -> tuple[dict[str, dict[str, Any]], dict[int, dict[str, Any]]]:
    global_by_canonical: dict[str, dict[str, Any]] = {}
    global_by_cluster_id: dict[int, dict[str, Any]] = {}
    for cluster in clusters:
        if not isinstance(cluster, dict):
            continue
        canonical = _string_value(cluster.get("canonical_intent")) or _string_value(cluster.get("suggested_name"))
        if canonical:
            global_by_canonical[canonical] = cluster
        cluster_id = _int_value(cluster.get("cluster_id"))
        if cluster_id is not None:
            global_by_cluster_id[cluster_id] = cluster
    return global_by_canonical, global_by_cluster_id


def _group_segment_rows_by_consultation(
    segment_rows: list[dict[str, Any]],
) -> dict[str, dict[str, list[dict[str, Any]]]]:
    grouped: dict[str, dict[str, list[dict[str, Any]]]] = {}
    for row in segment_rows:
        consultation_id = _string_value(row.get("consultation_id"))
        canonical = _string_value(row.get("canonical_intent"))
        if consultation_id and canonical:
            grouped.setdefault(consultation_id, {}).setdefault(canonical, []).append(row)
    return grouped


def _build_local_consultation_cluster(
    local_cluster_id: int,
    consultation_id: str,
    canonical: str,
    rows: list[dict[str, Any]],
    global_by_canonical: dict[str, dict[str, Any]],
    global_by_cluster_id: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    base = _base_cluster(canonical, rows[0], global_by_canonical, global_by_cluster_id)
    workflow_signal = base.get("workflow_signal")
    return {
        "cluster_id": local_cluster_id,
        "canonical_intent": canonical,
        "suggested_name": canonical,
        "description": _string_value(base.get("description")) or _description_from_canonical(canonical),
        "suggested_description": _string_value(base.get("suggested_description"))
        or _description_from_canonical(canonical),
        "cluster_size": len(rows),
        "source": base.get("source") or "consultation_split_v1",
        "segment_ids": _non_empty_values(_string_value(row.get("segment_id")) for row in rows),
        "sample_intent_phrases": _unique_non_empty(
            (_string_value(row.get("intent_phrase_refined")) or canonical for row in rows),
        )[:8],
        "sample_segment_texts": _non_empty_values(_string_value(row.get("segment_customer_text")) for row in rows)[:5],
        "member_conv_ids": [consultation_id],
        "exemplar_conv_ids": [consultation_id],
        "workflow_signal": workflow_signal
        if isinstance(workflow_signal, dict)
        else _workflow_signal_from_canonical(canonical),
        "fallback_name": bool(base.get("fallback_name", canonical == INTENT_MISC)),
    }


def _base_cluster(
    canonical: str,
    first_row: dict[str, Any],
    global_by_canonical: dict[str, dict[str, Any]],
    global_by_cluster_id: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    cluster_id = _int_value(first_row.get("cluster_id"))
    if canonical in global_by_canonical:
        return global_by_canonical[canonical]
    if cluster_id is not None and cluster_id in global_by_cluster_id:
        return global_by_cluster_id[cluster_id]
    return {}


def _non_empty_values(values: Iterable[str | None]) -> list[str]:
    return [value for value in values if value]


def _unique_non_empty(values: Iterable[str | None]) -> list[str]:
    return list(dict.fromkeys(value for value in values if value).keys())


def _upstream_stage_dir(
    stage_name: str,
    runtime_config: PipelineRuntimeConfig,
    stage_context: StageContext,
) -> Path:
    upstream = StageContext(
        dag_id=stage_context.dag_id,
        run_id=stage_context.run_id,
        stage_name=stage_name,
        workspace_id=stage_context.workspace_id,
        dataset_id=stage_context.dataset_id,
        pipeline_job_id=stage_context.pipeline_job_id,
    )
    return upstream.artifact_dir(runtime_config)


def _build_candidate_artifact(
    cluster_groups: dict[str, list[dict[str, Any]]],
    preprocessed_index: dict[str, dict[str, Any]],
    cases_per_intent: int,
    stage_context: StageContext,
) -> tuple[dict[str, Any], dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    intent_metrics = _empty_intent_metrics()
    workflow_metrics = _empty_workflow_metrics()
    slot_metrics = _empty_slot_metrics()

    for consultation_id, clusters in cluster_groups.items():
        scoped_consultation_id = consultation_id or None
        intents, current_intent_metrics = _build_intents(clusters, preprocessed_index, cases_per_intent)
        workflow_draft, current_workflow_metrics = _build_workflow_draft(clusters)
        slots, intent_slot_bindings, current_slot_metrics = _build_slot_draft(clusters)
        workflow_draft["slots"] = slots
        workflow_draft["intentSlotBindings"] = intent_slot_bindings
        candidates.append(_build_candidate(intents, workflow_draft, stage_context, scoped_consultation_id))
        _merge_numeric_metrics(intent_metrics, current_intent_metrics)
        _merge_numeric_metrics(workflow_metrics, current_workflow_metrics)
        _merge_numeric_metrics(slot_metrics, current_slot_metrics)

    if intent_metrics["intent_count"] > 0:
        intent_metrics["representative_case_avg_per_intent"] = (
            intent_metrics["representative_case_total"] / intent_metrics["intent_count"]
        )

    candidate: dict[str, Any]
    if len(candidates) == 1:
        candidate = candidates[0]
    else:
        candidate = {
            "schemaVersion": "1.0",
            "candidateMode": "consultation_split_v1",
            "candidates": candidates,
        }

    return candidate, {
        "candidate_count": len(candidates),
        "intent_metrics": intent_metrics,
        "workflow_metrics": workflow_metrics,
        "slot_metrics": slot_metrics,
    }


def _empty_intent_metrics() -> dict[str, Any]:
    return {
        "intent_count": 0,
        "representative_case_total": 0,
        "representative_case_avg_per_intent": 0.0,
        "intents_with_zero_cases": 0,
    }


def _empty_workflow_metrics() -> dict[str, Any]:
    return {
        "workflow_count": 0,
        "workflow_with_identify_count": 0,
        "workflow_with_payment_check_count": 0,
        "workflow_with_escalation_count": 0,
        "workflow_evidence_keyword_total": 0,
        "workflow_evidence_exemplar_total": 0,
        "workflow_evidence_member_total": 0,
        "workflow_with_empty_evidence_count": 0,
    }


def _empty_slot_metrics() -> dict[str, Any]:
    return {
        "slot_count": 0,
        "cluster_with_slot_count": 0,
        "signal_slot_hit_payment_check": 0,
        "signal_slot_hit_user_identification": 0,
        "signal_slot_hit_escalation": 0,
    }


def _merge_numeric_metrics(target: dict[str, Any], source: dict[str, Any]) -> None:
    for key, value in source.items():
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            continue
        if key.endswith("_avg_per_intent"):
            continue
        target[key] = target.get(key, 0) + value


def _flatten_metrics(metrics: dict[str, Any]) -> dict[str, Any]:
    return metrics


def _resolve_cases_per_intent() -> int:
    value = os.getenv("DRAFT_REPRESENTATIVE_CASES_PER_INTENT", "3").strip()
    try:
        return max(0, int(value))
    except ValueError:
        return 3


def _build_intents(
    clusters: list[Any],
    preprocessed_index: dict[str, dict[str, Any]],
    cases_per_intent: int,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    intents: list[dict[str, Any]] = []
    total_cases = 0
    zero_case_count = 0

    for cluster in clusters:
        if not isinstance(cluster, dict):
            continue
        cluster_id = cluster.get("cluster_id")
        exemplar_conv_ids: list[str] = cluster.get("exemplar_conv_ids") or []

        representative_cases = [
            _hydrate_case(preprocessed_index[conv_id])
            for conv_id in exemplar_conv_ids[:cases_per_intent]
            if conv_id in preprocessed_index
        ]

        if not representative_cases:
            zero_case_count += 1
        total_cases += len(representative_cases)

        intents.append(
            {
                "intentCode": f"INTENT_{cluster_id}",
                "name": cluster.get("canonical_intent") or cluster.get("suggested_name", f"INTENT_{cluster_id}"),
                "description": cluster.get("description") or cluster.get("suggested_description"),
                "taxonomyLevel": 1,
                "parentIntentCode": None,
                "sourceClusterRef": _compact_json(
                    {
                        "clusterId": cluster_id,
                        "clusterSize": cluster.get("cluster_size"),
                        "source": cluster.get("source"),
                        "canonicalIntent": cluster.get("canonical_intent") or cluster.get("suggested_name"),
                        "segmentIds": _string_list(cluster.get("segment_ids"), limit=100),
                    }
                ),
                "entryConditionJson": "{}",
                "evidenceJson": _compact_json(
                    {
                        "sampleIntentPhrases": _string_list(cluster.get("sample_intent_phrases"), limit=8),
                        "sampleSegmentTexts": _string_list(cluster.get("sample_segment_texts"), limit=5, max_chars=300),
                        "exemplarConversationIds": _string_list(cluster.get("exemplar_conv_ids"), limit=10),
                    }
                ),
                "metaJson": _compact_json(
                    {
                        "fallbackName": bool(cluster.get("fallback_name", False)),
                        "pipelineVersion": "boundary_segment_v1",
                    }
                ),
                "representativeCases": representative_cases,
            }
        )

    intent_count = len(intents)
    metrics: dict[str, Any] = {
        "intent_count": intent_count,
        "representative_case_total": total_cases,
        "representative_case_avg_per_intent": (total_cases / intent_count) if intent_count > 0 else 0.0,
        "intents_with_zero_cases": zero_case_count,
    }
    return intents, metrics


def _compact_json(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _string_list(value: Any, limit: int, max_chars: int | None = None) -> list[str]:
    if not isinstance(value, list):
        return []
    output: list[str] = []
    for item in value:
        if len(output) >= limit:
            break
        if not isinstance(item, str) or not item:
            continue
        output.append(item[:max_chars] if max_chars is not None else item)
    return output


def _hydrate_case(conv: dict[str, Any]) -> dict[str, Any]:
    return {
        "conversationId": conv.get("id", ""),
        "canonicalText": conv.get("canonical_text", ""),
        "customerProblemText": conv.get("customer_problem_text", ""),
        "endedStatus": conv.get("ended_status"),
    }


def _derive_pack_identity(stage_context: StageContext, consultation_id: str | None = None) -> tuple[str, str]:
    if stage_context.workspace_id is None or stage_context.dataset_id is None:
        raise PipelineStageError("packKey requires both workspace_id and dataset_id in StageContext.")
    base_key = f"pack_ws{stage_context.workspace_id}_ds{stage_context.dataset_id}"
    base_name = f"Pack ws{stage_context.workspace_id}/ds{stage_context.dataset_id}"
    if consultation_id:
        slug = _slugify(consultation_id, max_length=max(16, 100 - len(base_key) - 6))
        pack_key = f"{base_key}_conv_{slug}"
        pack_name = f"{base_name}/{consultation_id}"[:255]
        return pack_key[:100], pack_name
    pack_key = base_key
    pack_name = base_name
    return pack_key, pack_name


def _slugify(value: str, max_length: int) -> str:
    slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", value).strip("-_").lower()
    return (slug or "conversation")[:max_length]


def _aggregate_evidence_metrics(
    evidence_items: list[dict[str, Any]],
    evidence_json_str: str,
    cluster_id: Any,
) -> tuple[int, int, int]:
    kw_count = sum(1 for item in evidence_items if item.get("type") == "keyword")
    ex_count = sum(1 for item in evidence_items if item.get("type") == "exemplar_conv_id")
    mb_count = sum(1 for item in evidence_items if item.get("type") == "member_conv_id")
    _logger.info(
        "draft_generation.workflow_evidence_built cluster_id=%s workflow_code=%s"
        " keyword_count=%d exemplar_count=%d member_count=%d total_count=%d serialized_length=%d",
        cluster_id,
        f"WORKFLOW_{cluster_id}",
        kw_count,
        ex_count,
        mb_count,
        len(evidence_items),
        len(evidence_json_str),
    )
    return kw_count, ex_count, mb_count


def _default_dummy_policy() -> dict[str, Any]:
    return {
        "policyCode": DUMMY_POLICY_CODE,
        "name": "Default policy (Dummy)",
        "description": (
            "Workflow ACTION 노드의 V8c policyRef 검증을 충족하기 위한 "
            "placeholder dummy policy. 후속 backlog spec(별도 2.2.x)에서 "
            "cluster context 기반 실제 policy로 대체 예정."
        ),
        "severity": "LOW",
        "conditionJson": "{}",
        "actionJson": "{}",
        "evidenceJson": "[]",
        "metaJson": "{}",
    }


def _process_cluster_entry(
    cluster: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any], int, int, int, bool, dict[str, Any]] | None:
    if not isinstance(cluster, dict):
        return None
    cluster_id = cluster.get("cluster_id")
    if not isinstance(cluster_id, int):
        return None
    suggested_name = str(cluster.get("suggested_name") or f"INTENT_{cluster_id}")
    workflow_signal = cluster.get("workflow_signal")
    signal_payload = workflow_signal if isinstance(workflow_signal, dict) else {}
    context = ClusterContext(
        cluster_id=cluster_id,
        suggested_name=suggested_name,
        workflow_signal=signal_payload,
    )
    graph_spec = signal_based_generator(context)
    signal = context.workflow_signal or {}
    _logger.info(
        "draft_generation.workflow_built cluster_id=%s workflow_code=%s"
        " identify=%s payment=%s escalation=%s node_count=%d edge_count=%d",
        cluster_id,
        f"WORKFLOW_{cluster_id}",
        bool(signal.get("requires_user_identification")),
        bool(signal.get("requires_payment_check")),
        bool(signal.get("has_escalation_cases")),
        len(graph_spec.nodes),
        len(graph_spec.edges),
    )
    evidence_items = build_workflow_evidence(cluster)
    evidence_json_str = serialize_evidence_json(evidence_items)
    kw_count, ex_count, mb_count = _aggregate_evidence_metrics(evidence_items, evidence_json_str, cluster_id)
    workflow = {
        "workflowCode": f"WORKFLOW_{cluster_id}",
        "name": suggested_name,
        "description": f"{suggested_name} 자동 생성 workflow",
        "graphJson": serialize_graph_json(graph_spec),
        "evidenceJson": evidence_json_str,
        "metaJson": "{}",
    }
    binding = {
        "intentCode": f"INTENT_{cluster_id}",
        "workflowCode": f"WORKFLOW_{cluster_id}",
        "isPrimary": True,
        "routeConditionJson": "{}",
    }
    return workflow, binding, kw_count, ex_count, mb_count, not evidence_items, signal


def _build_workflow_draft(
    clusters: list[dict[str, Any]],
) -> tuple[dict[str, Any], dict[str, Any]]:
    workflows: list[dict[str, Any]] = []
    bindings: list[dict[str, Any]] = []
    workflow_count = 0
    identify_count = 0
    payment_count = 0
    escalation_count = 0
    keyword_total = 0
    exemplar_total = 0
    member_total = 0
    empty_evidence_count = 0

    for cluster in clusters:
        result = _process_cluster_entry(cluster)
        if result is None:
            continue
        workflow, binding, kw, ex, mb, is_empty, signal = result
        workflows.append(workflow)
        bindings.append(binding)
        keyword_total += kw
        exemplar_total += ex
        member_total += mb
        empty_evidence_count += is_empty
        workflow_count += 1
        identify_count += bool(signal.get("requires_user_identification"))
        payment_count += bool(signal.get("requires_payment_check"))
        escalation_count += bool(signal.get("has_escalation_cases"))

    draft = {
        "slots": [],
        "policies": [_default_dummy_policy()],
        "risks": [],
        "workflows": workflows,
        "intentSlotBindings": [],
        "intentWorkflowBindings": bindings,
    }
    workflow_metrics = {
        "workflow_count": workflow_count,
        "workflow_with_identify_count": identify_count,
        "workflow_with_payment_check_count": payment_count,
        "workflow_with_escalation_count": escalation_count,
        "workflow_evidence_keyword_total": keyword_total,
        "workflow_evidence_exemplar_total": exemplar_total,
        "workflow_evidence_member_total": member_total,
        "workflow_with_empty_evidence_count": empty_evidence_count,
    }
    return draft, workflow_metrics


def _build_slot_draft(
    clusters: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, int]]:
    """cluster.workflow_signal 기반으로 slots + intentSlotBindings 도출.

    Returns:
        (slots, intentSlotBindings, metrics)
    """
    slots: list[dict[str, Any]] = []
    bindings: list[dict[str, Any]] = []
    cluster_with_slot_count = 0
    signal_hit_counts: dict[str, int] = {key: 0 for key in SIGNAL_SLOT_MAPPING}

    for cluster in clusters:
        if not isinstance(cluster, dict):
            continue
        cluster_id = cluster.get("cluster_id")
        signal = cluster.get("workflow_signal") or {}
        intent_code = f"INTENT_{cluster_id}"
        cluster_slot_counter = 0

        for signal_key, templates in SIGNAL_SLOT_MAPPING.items():
            if not signal.get(signal_key):
                continue
            signal_hit_counts[signal_key] += 1
            for template in templates:
                cluster_slot_counter += 1
                slot_code = f"SLOT_{cluster_id}_{cluster_slot_counter}"
                slots.append(
                    {
                        "slotCode": slot_code,
                        "name": template.name,
                        "description": template.description,
                        "dataType": template.data_type,
                        "isSensitive": template.is_sensitive,
                        "validationRuleJson": "{}",
                        "defaultValueJson": None,
                        "metaJson": "{}",
                    }
                )
                bindings.append(
                    {
                        "intentCode": intent_code,
                        "slotCode": slot_code,
                        "isRequired": True,
                        "collectionOrder": cluster_slot_counter,
                        "promptHint": "",
                        "conditionJson": "{}",
                    }
                )
        if cluster_slot_counter > 0:
            cluster_with_slot_count += 1

    metrics: dict[str, int] = {
        "slot_count": len(slots),
        "cluster_with_slot_count": cluster_with_slot_count,
        "signal_slot_hit_payment_check": signal_hit_counts["requires_payment_check"],
        "signal_slot_hit_user_identification": signal_hit_counts["requires_user_identification"],
        "signal_slot_hit_escalation": signal_hit_counts["has_escalation_cases"],
    }
    return slots, bindings, metrics


def _build_candidate(
    intents: list[dict[str, Any]],
    workflow_draft: dict[str, Any],
    stage_context: StageContext,
    consultation_id: str | None = None,
) -> dict[str, Any]:
    pack_key, pack_name = _derive_pack_identity(stage_context, consultation_id)
    domain_pack_draft: dict[str, Any] = {
        "packKey": pack_key,
        "packName": pack_name,
    }
    if consultation_id:
        domain_pack_draft["summaryJson"] = _compact_json(
            {
                "generationScope": "consultation",
                "consultationId": consultation_id,
                "workspaceId": stage_context.workspace_id,
                "datasetId": stage_context.dataset_id,
                "pipelineVersion": "consultation_split_v1",
            }
        )
    return {
        "schemaVersion": "1.0",
        "consultationId": consultation_id,
        "domainPackDraft": domain_pack_draft,
        "intentDraft": {
            "intents": intents,
        },
        "workflowDraft": workflow_draft,
    }


def _string_value(value: object) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _int_value(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdecimal():
        return int(value)
    return None


def _description_from_canonical(canonical: str) -> str:
    return f"고객이 {canonical.replace(' 문의', '')}와 관련해 확인, 요청 또는 상담을 원하는 의도"


def _workflow_signal_from_canonical(canonical: str) -> dict[str, bool]:
    return {
        "requires_payment_check": bool(re.search(r"결제|입금|환불|가격|견적|요금|비용", canonical)),
        "requires_user_identification": bool(re.search(r"예약|변경|취소|환불|신청", canonical)),
        "has_escalation_cases": bool(re.search(r"문제|보상|불만|컴플레인", canonical)),
    }


def _write_candidate(
    stage_context: StageContext,
    runtime_config: PipelineRuntimeConfig,
    candidate: dict[str, Any],
) -> Path:
    output_dir = ensure_stage_directory(stage_context, runtime_config)
    candidate_path = output_dir / DEFAULT_CANDIDATE_ARTIFACT
    candidate_path.write_text(json.dumps(candidate, indent=2, ensure_ascii=False), encoding="utf-8")
    return candidate_path
