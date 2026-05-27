from __future__ import annotations

import json
import logging
import os
import time
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

    cases_per_intent = _resolve_cases_per_intent()
    candidate, metrics = _build_candidate_artifact(
        clusters_payload,
        clusters,
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
    flow_split_path = _upstream_stage_dir("flow_splitting", runtime_config, stage_context) / DEFAULT_CLUSTERS_ARTIFACT
    clusters_path = (
        flow_split_path
        if flow_split_path.exists()
        else _upstream_stage_dir("intent_discovery", runtime_config, stage_context) / DEFAULT_CLUSTERS_ARTIFACT
    )
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
    clusters_payload: dict[str, Any],
    clusters: list[Any],
    preprocessed_index: dict[str, dict[str, Any]],
    cases_per_intent: int,
    stage_context: StageContext,
) -> tuple[dict[str, Any], dict[str, Any]]:
    intents, intent_metrics = _build_intents(clusters, preprocessed_index, cases_per_intent)
    workflow_draft, workflow_metrics = _build_workflow_draft(clusters)
    slots, intent_slot_bindings, slot_metrics = _build_slot_draft(clusters)
    workflow_draft["slots"] = slots
    workflow_draft["intentSlotBindings"] = intent_slot_bindings

    if intent_metrics["intent_count"] > 0:
        intent_metrics["representative_case_avg_per_intent"] = (
            intent_metrics["representative_case_total"] / intent_metrics["intent_count"]
        )

    evaluation_inputs = _evaluation_inputs(clusters_payload, intent_metrics, workflow_metrics, slot_metrics)
    candidate = _build_candidate(intents, workflow_draft, stage_context, evaluation_inputs)

    return candidate, {
        "candidate_count": 1,
        "intent_metrics": intent_metrics,
        "workflow_metrics": workflow_metrics,
        "slot_metrics": slot_metrics,
        "evaluation_inputs": evaluation_inputs,
    }


def _flatten_metrics(metrics: dict[str, Any]) -> dict[str, Any]:
    return metrics


def _evaluation_inputs(
    clusters_payload: dict[str, Any],
    intent_metrics: dict[str, Any],
    workflow_metrics: dict[str, Any],
    slot_metrics: dict[str, int],
) -> dict[str, Any]:
    stats = clusters_payload.get("stats")
    flow_metrics = clusters_payload.get("flow_split_metrics")
    return {
        "mappingRate": _candidate_mapping_rate(intent_metrics, workflow_metrics),
        "outlierRate": _float_metric(stats, "outlier_rate", "outlierRate"),
        "workflowSeparability": _float_metric(flow_metrics, "workflowSeparability"),
        "slotCoverage": _ratio(slot_metrics["cluster_with_slot_count"], intent_metrics["intent_count"]),
    }


def _candidate_mapping_rate(intent_metrics: dict[str, Any], workflow_metrics: dict[str, Any]) -> float:
    intent_count = _int_metric(intent_metrics, "intent_count")
    workflow_count = _int_metric(workflow_metrics, "workflow_count")
    if intent_count <= 0 or workflow_count <= 0:
        return 0.0
    return min(intent_count, workflow_count) / max(intent_count, workflow_count)


def _ratio(numerator: int, denominator: int) -> float | None:
    if denominator <= 0:
        return None
    return numerator / denominator


def _int_metric(payload: dict[str, Any], key: str) -> int:
    value = payload.get(key)
    return value if isinstance(value, int) and not isinstance(value, bool) else 0


def _float_metric(payload: object, *keys: str) -> float | None:
    if not isinstance(payload, dict):
        return None
    for key in keys:
        value = payload.get(key)
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return float(value)
    return None


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
                        "keywords": _string_list(cluster.get("keywords"), limit=8),
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


def _derive_pack_identity(stage_context: StageContext) -> tuple[str, str]:
    if stage_context.workspace_id is None or stage_context.dataset_id is None:
        raise PipelineStageError("packKey requires both workspace_id and dataset_id in StageContext.")
    base_key = f"pack_ws{stage_context.workspace_id}_ds{stage_context.dataset_id}"
    base_name = f"Pack ws{stage_context.workspace_id}/ds{stage_context.dataset_id}"
    pack_key = base_key
    pack_name = base_name
    return pack_key, pack_name


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
        "metaJson": '{"evidencePolicy":"human_review_required"}',
        "reviewStatus": "needs_review",
    }


def _process_cluster_entry(
    cluster: dict[str, Any],
) -> tuple[dict[str, Any], int, int, int, bool, dict[str, Any]] | None:
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
        "intentCode": f"INTENT_{cluster_id}",
        "isPrimary": True,
        "routeConditionJson": "{}",
    }
    return workflow, kw_count, ex_count, mb_count, not evidence_items, signal


def _build_workflow_draft(
    clusters: list[dict[str, Any]],
) -> tuple[dict[str, Any], dict[str, Any]]:
    workflows: list[dict[str, Any]] = []
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
        workflow, kw, ex, mb, is_empty, signal = result
        workflows.append(workflow)
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
    evaluation_inputs: dict[str, Any] | None = None,
) -> dict[str, Any]:
    pack_key, pack_name = _derive_pack_identity(stage_context)
    domain_pack_draft: dict[str, Any] = {
        "packKey": pack_key,
        "packName": pack_name,
    }
    return {
        "schemaVersion": "1.0",
        "domainPackDraft": domain_pack_draft,
        "intentDraft": {
            "intents": intents,
        },
        "workflowDraft": workflow_draft,
        "evaluationInputs": evaluation_inputs or {},
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
