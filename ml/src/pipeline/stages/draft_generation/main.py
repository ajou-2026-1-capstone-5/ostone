from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path
from typing import Any

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
    intents, metrics = _build_intents(clusters, preprocessed_index, cases_per_intent)
    logger.info(
        "draft_generation.intent_built intent_count=%d representative_case_total=%d intents_with_zero_cases=%d",
        metrics["intent_count"],
        metrics["representative_case_total"],
        metrics["intents_with_zero_cases"],
    )

    workflow_draft, workflow_metrics = _build_workflow_draft(clusters)
    metrics.update(workflow_metrics)
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

    candidate = _build_candidate(intents, workflow_draft, stage_context)
    logger.info(
        "draft_generation.pack_identity pack_key=%s pack_name=%s",
        candidate["domainPackDraft"]["packKey"],
        candidate["domainPackDraft"]["packName"],
    )

    candidate_path = _write_candidate(stage_context, runtime_config, candidate)

    metrics["processing_duration_seconds"] = time.monotonic() - start

    manifest = write_stage_manifest(
        stage_context,
        runtime_config,
        {"candidateArtifactPath": candidate_path.name, "metrics": metrics},
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
                "name": cluster.get("suggested_name", f"INTENT_{cluster_id}"),
                "description": cluster.get("suggested_description"),
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
    pack_key = f"pack_ws{stage_context.workspace_id}_ds{stage_context.dataset_id}"
    pack_name = f"Pack ws{stage_context.workspace_id}/ds{stage_context.dataset_id}"
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
        "metaJson": "{}",
    }


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
        if not isinstance(cluster, dict):
            continue
        cluster_id = cluster.get("cluster_id")
        suggested_name = cluster.get("suggested_name") or f"INTENT_{cluster_id}"
        context = ClusterContext(
            cluster_id=cluster_id,
            suggested_name=suggested_name,
            workflow_signal=cluster.get("workflow_signal") or {},
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
        keyword_total += kw_count
        exemplar_total += ex_count
        member_total += mb_count
        if not evidence_items:
            empty_evidence_count += 1

        workflows.append(
            {
                "workflowCode": f"WORKFLOW_{cluster_id}",
                "name": suggested_name,
                "description": f"{suggested_name} 자동 생성 workflow",
                "graphJson": serialize_graph_json(graph_spec),
                "evidenceJson": evidence_json_str,
                "metaJson": "{}",
            }
        )
        bindings.append(
            {
                "intentCode": f"INTENT_{cluster_id}",
                "workflowCode": f"WORKFLOW_{cluster_id}",
                "isPrimary": True,
                "routeConditionJson": "{}",
            }
        )
        workflow_count += 1
        if signal.get("requires_user_identification"):
            identify_count += 1
        if signal.get("requires_payment_check"):
            payment_count += 1
        if signal.get("has_escalation_cases"):
            escalation_count += 1

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


def _build_candidate(
    intents: list[dict[str, Any]],
    workflow_draft: dict[str, Any],
    stage_context: StageContext,
) -> dict[str, Any]:
    pack_key, pack_name = _derive_pack_identity(stage_context)
    return {
        "schemaVersion": "1.0",
        "domainPackDraft": {
            "packKey": pack_key,
            "packName": pack_name,
        },
        "intentDraft": {
            "intents": intents,
        },
        "workflowDraft": workflow_draft,
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
