from __future__ import annotations

import json
import logging
import os
import re
import time
from collections import Counter
from pathlib import Path
from typing import Any, NamedTuple

from pipeline.common.artifacts import ensure_stage_directory, write_stage_manifest
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineStageError
from pipeline.common.logging import get_stage_logger
from pipeline.stages.draft_generation.contracts import (
    ClustersArtifact,
    DraftGenerationCandidateArtifact,
    PreprocessedArtifact,
    ProcessedWorkflow,
    WorkflowDraftArtifact,
)
from pipeline.stages.draft_generation.description_enrichment import enrich_candidate_descriptions
from pipeline.stages.draft_generation.knowledge_extraction import (
    build_evidence_based_slot_draft,
    build_policy_risk_draft,
)
from pipeline.stages.draft_generation.workflow_evidence import (
    build_workflow_evidence,
    serialize_evidence_json,
)
from pipeline.stages.draft_generation.workflow_graph import (
    DUMMY_POLICY_CODE,
    ClusterContext,
    GraphEdgeSpec,
    GraphNodeSpec,
    WorkflowGraphSpec,
    frequent_path_generator,
    graph_event_specificity,
    graph_transition_coverage,
    graph_transition_precision,
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
        SlotTemplate(
            "request_reference",
            "업무 식별 정보",
            "처리 대상 업무를 식별하기 위한 참조 정보",
            "STRING",
            False,
        ),
        SlotTemplate("payment_method", "결제/납부 수단", "결제, 납부, 입금, 이체에 사용하는 수단", "STRING", False),
    ),
    "requires_user_identification": (
        SlotTemplate(
            "identity_information",
            "본인 확인 정보",
            "권한 있는 요청자인지 확인하기 위한 정보",
            "STRING",
            True,
        ),
    ),
    "has_escalation_cases": (
        SlotTemplate("handoff_reason", "추가 검토 사유", "추가 확인이나 사람 검토가 필요한 사유", "STRING", False),
    ),
}
LOW_SUPPORT_REVIEW_ONLY_MIN_CASES = 3
LOW_SUPPORT_REVIEW_ONLY_PATH_SUPPORT = 0.50
MAX_ROUTE_TERMS = 6
MAX_REQUIRED_ROUTE_TERMS = 4
MAX_CONTROL_SLOT_NODES = 4
MAX_CONTROL_RISK_NODES = 2
ROUTE_TERM_STOPWORDS = frozenset(
    {
        "문의",
        "확인",
        "정보확인",
        "가능여부확인",
        "검토",
        "요청",
        "처리",
        "흐름",
        "미분류",
        "상담",
        "고객",
        "고객님",
        "손님",
        "합니다",
        "해주세요",
        "주세요",
        "해주실",
        "해주시면",
        "어떻게",
        "무엇",
        "무슨",
        "어떤",
        "어디",
        "언제",
        "가능한",
        "가능한가",
        "혹시",
        "그럼",
        "그러면",
        "그리고",
        "그런데",
        "아니",
        "아니요",
        "아예",
        "그래",
        "그래요",
        "그거",
        "이거",
        "저거",
        "그게",
        "이게",
        "저게",
        "저기",
        "제가",
        "저는",
        "지금",
        "이제",
        "오늘",
        "다시",
        "항상",
        "바로",
        "한번",
        "잠시만",
        "잠깐",
        "정도인",
        "관련",
        "관련된",
        "으로",
        "부터",
        "까지",
        "하는",
        "하는데",
        "되는",
        "있는",
        "있어",
        "있는데",
        "있고",
        "있나",
        "없는",
        "없이",
        "으면",
        "하면",
        "되잖아",
        "들어오면",
        "쓰고",
        "싶어",
        "싶어요",
        "싶은데",
        "거예",
        "에요",
        "가요",
        "건가",
        "건지",
        "뭐지",
        "달에",
        "주시",
        "추천해",
        "알아서",
        "알겠습니다",
        "알겠어요",
        "알겠어",
        "그렇군",
        "그렇군요",
        "여보세요",
        "여보세",
        "맞습니다",
        "맞아요",
        "잠시만요",
        "모르겠는데",
        "여쭤보",
        "여쭤보려고",
        "귀찮아서",
        "바뀐",
        "이거죠",
        "이카드",
        "시스템",
        "그러니까",
        "그런",
        "똑같",
        "뒤에",
        "원래",
        "별도",
        "포함",
        "자세히",
        "매달",
        "받았",
        "이대",
        "가까운",
        "케이스",
        "드렸",
        "아아",
        "안한",
        "없구",
        "무조건",
        "나왔어",
        "돈이",
        "이걸",
        "언제쯤",
        "이요",
        "입니다",
        "데서",
        "통해",
        "이용하",
        "요청확인",
        "정보수집",
        "알려드릴",
        "받을",
        "다른",
        "사람",
        "엄마",
        "아빠",
        "부모",
        "신랑",
        "남편",
        "아내",
        "딸",
        "아들",
        "명만",
        "name",
        "date",
        "time",
        "birth",
        "birth_number",
        "phone",
        "phone_number",
        "mobile",
        "mobile_number",
        "email",
        "email_address",
        "address",
        "card_number",
        "account",
        "amount",
        "charge",
    }
)
ACTION_ROUTE_TERMS = (
    "변경",
    "취소",
    "해지",
    "환불",
    "신청",
    "조회",
    "발급",
    "결제",
    "청구",
    "납부",
    "이체",
    "출금",
    "예약",
    "견적",
    "인증",
    "구매",
    "확인",
)


def run(upstream_manifest_path: str | None = None) -> dict[str, object]:
    start = time.monotonic()
    runtime_config = PipelineRuntimeConfig.from_env()
    stage_context = read_stage_context(upstream_manifest_path, stage_name="draft_generation")
    logger = get_stage_logger(stage_context)

    logger.info("draft_generation.start %s", stage_context)

    clusters_artifact = _read_clusters(runtime_config, stage_context)
    clusters_payload = clusters_artifact.payload
    clusters = clusters_artifact.clusters
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
        runtime_config,
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


def _read_clusters(runtime_config: PipelineRuntimeConfig, stage_context: StageContext) -> ClustersArtifact:
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
    return ClustersArtifact.from_payload(payload, clusters_path)


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
    return PreprocessedArtifact.from_payload(data, preprocessed_path).conversation_index()


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
    runtime_config: PipelineRuntimeConfig,
) -> tuple[dict[str, Any], dict[str, Any]]:
    intents, intent_metrics = _build_intents(clusters, preprocessed_index, cases_per_intent)
    slots, intent_slot_bindings, slot_metrics = _build_slot_draft(clusters, preprocessed_index)
    policies, risks, policy_refs_by_cluster, knowledge_metrics = build_policy_risk_draft(clusters, preprocessed_index)
    workflow_draft, workflow_metrics = _build_workflow_draft(
        clusters,
        preprocessed_index=preprocessed_index,
        policy_refs_by_cluster=policy_refs_by_cluster,
        slots=slots,
        intent_slot_bindings=intent_slot_bindings,
        policies=policies,
        risks=risks,
    )
    workflow_draft["slots"] = slots
    workflow_draft["intentSlotBindings"] = intent_slot_bindings
    workflow_draft["policies"] = policies
    workflow_draft["risks"] = risks

    if intent_metrics["intent_count"] > 0:
        intent_metrics["representative_case_avg_per_intent"] = (
            intent_metrics["representative_case_total"] / intent_metrics["intent_count"]
        )

    evaluation_inputs = _evaluation_inputs(
        clusters_payload,
        intent_metrics,
        workflow_metrics,
        slot_metrics,
        knowledge_metrics,
    )
    candidate = _build_candidate(intents, workflow_draft, stage_context, evaluation_inputs)
    candidate["structureSnapshot"] = _build_structure_snapshot(clusters_payload, clusters)
    llm_summary = enrich_candidate_descriptions(candidate, runtime_config, logger=_logger)
    candidate["llmSummary"] = llm_summary

    metrics = {
        "candidate_count": 1,
        "intent_metrics": intent_metrics,
        "workflow_metrics": workflow_metrics,
        "slot_metrics": slot_metrics,
        "knowledge_metrics": knowledge_metrics,
        "evaluation_inputs": evaluation_inputs,
        "llm_metrics": llm_summary,
    }
    return candidate, metrics


def _build_structure_snapshot(
    clusters_payload: dict[str, Any],
    clusters: list[Any],
) -> dict[str, Any]:
    """replay 전후 비교용 intent/workflow membership·label 스냅샷.

    backend가 중간 산출물을 보지 못하므로 candidate에 임베드해 둔다. membership은 split/merge
    판정에 쓰이므로 truncate하지 않는다.
    """
    intents_by_id: dict[str, dict[str, Any]] = {}
    workflows: list[dict[str, Any]] = []
    for index, cluster in enumerate(clusters):
        if not isinstance(cluster, dict):
            continue
        members = _conv_id_list(cluster.get("member_conv_ids"))
        source_id = cluster.get("source_cluster_id")
        if source_id is None:
            source_id = cluster.get("cluster_id")
        # id가 없으면 cluster마다 고유 id를 부여해 서로 다른 intent가 ""로 합쳐지지 않게 한다.
        intent_id = str(source_id).strip() if source_id is not None else f"intent-{index}"
        if not intent_id:
            intent_id = f"intent-{index}"
        workflow_id = cluster.get("workflow_entrypoint_id") or f"cluster-{cluster.get('cluster_id', index)}"
        intent_label = _structure_label(cluster, "canonical_intent", "suggested_name")
        workflows.append(
            {
                "workflowId": str(workflow_id),
                "workflowLabel": _structure_label(cluster, "suggested_name", "canonical_intent"),
                "intentId": intent_id,
                "memberConversationIds": members,
            }
        )
        entry = intents_by_id.setdefault(intent_id, {"label": intent_label, "members": []})
        entry["members"].extend(members)
        if not entry["label"]:
            entry["label"] = intent_label
    intents = [
        {"intentId": intent_id, "intentLabel": data["label"], "memberConversationIds": data["members"]}
        for intent_id, data in intents_by_id.items()
    ]
    flow_metrics = clusters_payload.get("flow_split_metrics")
    workflow_feedback = flow_metrics.get("workflowFeedback") if isinstance(flow_metrics, dict) else None
    if not isinstance(workflow_feedback, dict):
        workflow_feedback = {"applied": [], "ignored": []}
    return {
        "schemaVersion": "structure-snapshot.v1",
        "intents": intents,
        "workflows": workflows,
        "workflowFeedback": workflow_feedback,
    }


def _structure_label(cluster: dict[str, Any], primary: str, fallback: str) -> str:
    value = cluster.get(primary) or cluster.get(fallback) or ""
    return str(value).strip()


def _conv_id_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for raw in value if (item := str(raw).strip())]


def _flatten_metrics(metrics: dict[str, Any]) -> dict[str, Any]:
    return metrics


def _evaluation_inputs(
    clusters_payload: dict[str, Any],
    intent_metrics: dict[str, Any],
    workflow_metrics: dict[str, Any],
    slot_metrics: dict[str, Any],
    knowledge_metrics: dict[str, Any] | None = None,
) -> dict[str, Any]:
    stats = clusters_payload.get("stats")
    flow_metrics = clusters_payload.get("flow_split_metrics")
    knowledge_metrics = knowledge_metrics or {}
    raw_outlier_rate = _float_metric(stats, "outlier_rate", "outlierRate")
    unrepresented_outlier_rate = _float_metric(flow_metrics, "unrepresentedOutlierRate")
    output = {
        "mappingRate": _candidate_mapping_rate(intent_metrics, workflow_metrics),
        "outlierRate": unrepresented_outlier_rate if unrepresented_outlier_rate is not None else raw_outlier_rate,
        "workflowSeparability": _float_metric(flow_metrics, "workflowSeparability"),
        "slotCoverage": _ratio(slot_metrics["cluster_with_slot_count"], _leaf_intent_count(intent_metrics)),
    }
    if unrepresented_outlier_rate is not None and raw_outlier_rate is not None:
        output["rawOutlierRate"] = raw_outlier_rate
    for output_key, metric_key in (
        ("representedOutlierCoverage", "representedOutlierCoverage"),
        ("promotedNovelCandidateCount", "promotedNovelCandidateCount"),
        ("promotedNovelMemberCount", "promotedNovelMemberCount"),
        ("unrepresentedOutlierMemberCount", "unrepresentedOutlierMemberCount"),
    ):
        value = _float_metric(flow_metrics, metric_key)
        if value is not None:
            output[output_key] = value
    label_metrics = _label_metrics(clusters_payload.get("clusters"))
    output.update(label_metrics)
    for output_key, metric_key in (
        ("parentIntentCount", "parent_intent_count"),
        ("leafIntentCount", "leaf_intent_count"),
        ("workflowVariantIntentCount", "workflow_variant_intent_count"),
        ("variantsPerParentIntentAvg", "variants_per_parent_intent_avg"),
        ("variantsPerParentIntentMax", "variants_per_parent_intent_max"),
        ("singleVariantIntentRate", "single_variant_intent_rate"),
    ):
        value = _float_metric(intent_metrics, metric_key)
        if value is not None:
            output[output_key] = value
    semantic_quality = clusters_payload.get("semantic_quality")
    if isinstance(semantic_quality, dict):
        output["semanticQualityFinal"] = semantic_quality.get("finalSemanticQuality") is True
        output["semanticEmbeddingRuntime"] = semantic_quality.get("embeddingRuntime")
        output["semanticEmbeddingModel"] = semantic_quality.get("embeddingModelName")
        for output_key, metric_key in (
            ("semanticClusterCohesion", "meanClusterCohesion"),
            ("semanticSeparationMargin", "meanSeparationMargin"),
            ("clusterDistinctiveness", "clusterDistinctiveness"),
            ("positiveMarginRate", "positiveMarginRate"),
            ("semanticSilhouetteProxy", "semanticSilhouetteProxy"),
        ):
            value = _float_metric(semantic_quality, metric_key)
            if value is not None:
                output[output_key] = value
        value = _float_metric(semantic_quality, "clusterStability")
        if value is not None:
            output["clusterStability"] = value
        same_intent_graph = semantic_quality.get("sameIntentGraph")
        value = _float_metric(same_intent_graph, "overmergeRisk")
        if value is not None:
            output["sameIntentOvermergeRisk"] = value
        value = _float_metric(same_intent_graph, "conflictPairRate")
        if value is not None:
            output["sameIntentGraphConflictPairRate"] = value
    for output_key, source, metric_key in (
        ("slotEvidenceCoverage", slot_metrics, "slot_evidence_coverage"),
        ("policyCoverage", knowledge_metrics, "policy_coverage"),
        ("riskCoverage", knowledge_metrics, "risk_coverage"),
        ("avgSlotsPerIntent", slot_metrics, "avg_slots_per_intent"),
        ("avgPoliciesPerIntent", knowledge_metrics, "avg_policies_per_intent"),
        ("avgRisksPerIntent", knowledge_metrics, "avg_risks_per_intent"),
        ("workflowPathSupport", workflow_metrics, "workflow_path_support"),
        ("workflowReplayFitness", workflow_metrics, "workflow_replay_fitness"),
        ("workflowPrecision", workflow_metrics, "workflow_precision"),
        ("workflowSpecificity", workflow_metrics, "workflow_specificity"),
        ("routeConditionCoverage", workflow_metrics, "route_condition_coverage"),
        ("specificNodeRatio", workflow_metrics, "specific_node_ratio"),
        ("workflowSpecificNodeRate", workflow_metrics, "workflow_with_specific_node_rate"),
        ("slotNodeCoverage", workflow_metrics, "slot_node_coverage"),
        ("policyNodeCoverage", workflow_metrics, "policy_node_coverage"),
        ("riskNodeCoverage", workflow_metrics, "risk_node_coverage"),
        ("lowSupportWorkflowRate", workflow_metrics, "low_support_workflow_rate"),
        ("reviewOnlyWorkflowCount", workflow_metrics, "review_only_workflow_count"),
    ):
        value = _float_metric(source, metric_key)
        if value is not None:
            output[output_key] = value
    for output_key, metric_key in (
        ("workflowConfidenceAvg", "workflowConfidenceAvg"),
        ("workflowConfidenceMin", "workflowConfidenceMin"),
        ("highConfidenceWorkflowCount", "highConfidenceWorkflowCount"),
        ("sampleReviewWorkflowCount", "sampleReviewWorkflowCount"),
        ("reviewRequiredWorkflowCount", "reviewRequiredWorkflowCount"),
        ("reviewRequiredRate", "reviewRequiredRate"),
        ("lowConfidenceWorkflowCount", "lowConfidenceWorkflowCount"),
        ("duplicateLabelRate", "duplicateLabelRate"),
        ("reviewCandidateDuplicateLabelRate", "reviewCandidateDuplicateLabelRate"),
        ("maxWorkflowCoverage", "maxWorkflowCoverage"),
        ("effectiveWorkflowCount", "effectiveWorkflowCount"),
        ("entrypointSemanticCoverage", "entrypointSemanticCoverage"),
        ("entrypointSemanticCohesion", "entrypointSemanticCohesion"),
        ("entrypointSemanticSeparationMargin", "entrypointSemanticSeparationMargin"),
        ("entrypointDistinctiveness", "entrypointDistinctiveness"),
        ("entrypointPositiveMarginRate", "entrypointPositiveMarginRate"),
    ):
        value = _float_metric(flow_metrics, metric_key)
        if value is not None:
            output[output_key] = value
    return output


def _label_metrics(clusters: object) -> dict[str, float]:
    if not isinstance(clusters, list):
        return {}
    primary_clusters = [
        item for item in clusters if isinstance(item, dict) and item.get("is_novel_outlier_candidate") is not True
    ]
    review_candidate_clusters = [
        item for item in clusters if isinstance(item, dict) and item.get("is_novel_outlier_candidate") is True
    ]
    metric_clusters = primary_clusters or [item for item in clusters if isinstance(item, dict)]
    auto_candidate_clusters = [
        item
        for item in metric_clusters
        if isinstance(item, dict) and str(item.get("label_validation_status")) == "auto_acceptable"
    ]
    review_required_clusters = [
        item
        for item in metric_clusters
        if isinstance(item, dict) and str(item.get("label_validation_status")) == "needs_review"
    ]
    scores = [
        float(value)
        for item in metric_clusters
        if isinstance(item, dict)
        and isinstance((value := item.get("label_score")), (int, float))
        and not isinstance(value, bool)
    ]
    evidence_coverages = [
        float(value)
        for item in metric_clusters
        if isinstance(item, dict)
        and isinstance((value := item.get("label_evidence_coverage")), (int, float))
        and not isinstance(value, bool)
    ]
    statuses = [str(item.get("label_validation_status")) for item in metric_clusters if isinstance(item, dict)]
    output: dict[str, float] = {}
    if scores:
        output["labelFidelity"] = sum(scores) / len(scores)
    if evidence_coverages:
        output["labelEvidenceCoverage"] = sum(evidence_coverages) / len(evidence_coverages)
    member_evidence_coverages = [
        float(value)
        for item in metric_clusters
        if isinstance(item, dict)
        and isinstance((value := item.get("label_member_evidence_coverage")), (int, float))
        and not isinstance(value, bool)
    ]
    if member_evidence_coverages:
        output["labelMemberEvidenceCoverage"] = sum(member_evidence_coverages) / len(member_evidence_coverages)
    for output_key, cluster_key in (
        ("labelObjectCoverage", "label_object_coverage"),
        ("labelActionCoverage", "label_action_coverage"),
        ("labelObjectActionJointCoverage", "label_object_action_joint_coverage"),
    ):
        values = [
            float(value)
            for item in metric_clusters
            if isinstance(item, dict)
            and isinstance((value := item.get(cluster_key)), (int, float))
            and not isinstance(value, bool)
        ]
        if values:
            output[output_key] = sum(values) / len(values)
    if statuses:
        output["labelNeedsReviewRate"] = sum(1 for status in statuses if status == "needs_review") / len(statuses)
    if auto_candidate_clusters:
        output["autoCandidateLabelCount"] = float(len(auto_candidate_clusters))
        _add_label_subset_metrics(output, "autoCandidate", auto_candidate_clusters)
    if review_required_clusters:
        output["reviewRequiredLabelCount"] = float(len(review_required_clusters))
        _add_label_subset_metrics(output, "reviewRequired", review_required_clusters)
    review_scores = [
        float(value)
        for item in review_candidate_clusters
        if isinstance((value := item.get("label_score")), (int, float)) and not isinstance(value, bool)
    ]
    if review_scores:
        output["reviewCandidateLabelFidelity"] = sum(review_scores) / len(review_scores)
    return output


def _add_label_subset_metrics(output: dict[str, float], prefix: str, clusters: list[dict[str, Any]]) -> None:
    score = _average_cluster_float(clusters, "label_score")
    member_evidence_coverage = _average_cluster_float(clusters, "label_member_evidence_coverage")
    object_action_joint_coverage = _average_cluster_float(clusters, "label_object_action_joint_coverage")
    if score is not None:
        output[f"{prefix}LabelFidelity"] = score
    if member_evidence_coverage is not None:
        output[f"{prefix}LabelMemberEvidenceCoverage"] = member_evidence_coverage
    if object_action_joint_coverage is not None:
        output[f"{prefix}LabelObjectActionJointCoverage"] = object_action_joint_coverage


def _average_cluster_float(clusters: list[dict[str, Any]], key: str) -> float | None:
    values = [
        float(value)
        for item in clusters
        if isinstance((value := item.get(key)), (int, float)) and not isinstance(value, bool)
    ]
    if not values:
        return None
    return sum(values) / len(values)


def _candidate_mapping_rate(intent_metrics: dict[str, Any], workflow_metrics: dict[str, Any]) -> float:
    intent_count = _leaf_intent_count(intent_metrics)
    workflow_count = _int_metric(workflow_metrics, "workflow_count")
    if intent_count <= 0 or workflow_count <= 0:
        return 0.0
    return min(intent_count, workflow_count) / max(intent_count, workflow_count)


def _leaf_intent_count(intent_metrics: dict[str, Any]) -> int:
    leaf_count = _int_metric(intent_metrics, "leaf_intent_count")
    return leaf_count if leaf_count > 0 else _int_metric(intent_metrics, "intent_count")


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
    usable_clusters = [cluster for cluster in clusters if isinstance(cluster, dict)]
    parent_groups = _parent_intent_groups(usable_clusters)
    parent_by_name = {group["name"]: group for group in parent_groups}
    used_intent_names: set[str] = set()

    for group in parent_groups:
        representative_cases = _representative_cases_for_member_ids(
            _string_list(group.get("exemplarConvIds"), limit=cases_per_intent),
            preprocessed_index,
            cases_per_intent,
        )
        if not representative_cases:
            zero_case_count += 1
        total_cases += len(representative_cases)
        name = str(group["name"])
        used_intent_names.add(name)
        intents.append(
            {
                "intentCode": group["code"],
                "name": name,
                "description": f"{name}의 공통 상위 intent입니다. 하위 workflow variant를 검토해 확정합니다.",
                "taxonomyLevel": 1,
                "parentIntentCode": None,
                "sourceClusterRef": _compact_json(
                    {
                        "source": "duplicate_label_parent_intent",
                        "canonicalIntent": name,
                        "childClusterIds": group["clusterIds"],
                        "variantIntentCodes": group["variantIntentCodes"],
                        "variantCount": group["variantCount"],
                        "clusterSize": group["clusterSize"],
                        "segmentIds": _string_list(group.get("memberIds"), limit=20),
                        "segments": _segment_details(
                            _string_list(group.get("memberIds"), limit=20),
                            preprocessed_index,
                            limit=3,
                        ),
                    }
                ),
                "entryConditionJson": "{}",
                "evidenceJson": _compact_json(
                    {
                        "exemplarConversationIds": _string_list(group.get("exemplarConvIds"), limit=10),
                        "variantIntentCodes": group["variantIntentCodes"],
                    }
                ),
                "metaJson": _compact_json(
                    {
                        "intentRole": "parent_intent",
                        "variantCount": group["variantCount"],
                        "variantIntentCodes": group["variantIntentCodes"],
                    }
                ),
                "representativeCases": representative_cases,
            }
        )

    variant_name_counts: dict[str, int] = {}
    for cluster in usable_clusters:
        cluster_id = cluster.get("cluster_id")
        exemplar_conv_ids: list[str] = cluster.get("exemplar_conv_ids") or []
        member_conv_ids = _cluster_member_ids(cluster)
        base_name = _intent_base_name(cluster, cluster_id)
        parent_group = parent_by_name.get(base_name)
        parent_code = str(parent_group["code"]) if parent_group else None
        intent_name = base_name
        taxonomy_level = 1
        variant_name = None
        if parent_group:
            taxonomy_level = 2
            variant_index = _variant_index(parent_group, cluster_id)
            variant_name = _workflow_variant_name(cluster, variant_index)
            intent_name = _unique_intent_name(f"{base_name} - {variant_name}", used_intent_names)
            variant_name_counts[base_name] = variant_name_counts.get(base_name, 0) + 1
        else:
            intent_name = _unique_intent_name(intent_name, used_intent_names)

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
                "name": intent_name,
                "description": cluster.get("description") or cluster.get("suggested_description"),
                "taxonomyLevel": taxonomy_level,
                "parentIntentCode": parent_code,
                "sourceClusterRef": _compact_json(
                    {
                        "clusterId": cluster_id,
                        "clusterSize": cluster.get("cluster_size"),
                        "source": cluster.get("source"),
                        "canonicalIntent": base_name,
                        "keywords": _string_list(cluster.get("keywords"), limit=8),
                        "parentIntentCode": parent_code,
                        "workflowVariantName": variant_name,
                        "workflowVariantIndex": _variant_index(parent_group, cluster_id) if parent_group else None,
                        "segmentIds": _string_list(member_conv_ids, limit=20),
                        "segments": _segment_details(member_conv_ids, preprocessed_index, limit=3),
                        "labelScore": cluster.get("label_score"),
                        "labelEvidenceCoverage": cluster.get("label_evidence_coverage"),
                        "labelValidationStatus": cluster.get("label_validation_status"),
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
                        "pipelineVersion": "graph_leiden_generic_v2",
                        "intentRole": "workflow_variant" if parent_group else "leaf_intent",
                        "parentIntentCode": parent_code,
                        "parentIntentName": base_name if parent_group else None,
                        "workflowVariantName": variant_name,
                        "labelScore": cluster.get("label_score"),
                        "labelEvidenceCoverage": cluster.get("label_evidence_coverage"),
                        "labelValidationStatus": cluster.get("label_validation_status"),
                        "labelCandidates": (
                            cluster.get("label_candidates") if isinstance(cluster.get("label_candidates"), list) else []
                        ),
                    }
                ),
                "representativeCases": representative_cases,
            }
        )

    intent_count = len(intents)
    metrics: dict[str, Any] = {
        "intent_count": intent_count,
        "parent_intent_count": len(parent_groups),
        "leaf_intent_count": len(usable_clusters),
        "workflow_variant_intent_count": sum(
            1 for cluster in usable_clusters if _intent_base_name(cluster, cluster.get("cluster_id")) in parent_by_name
        ),
        "variants_per_parent_intent_avg": (
            sum(int(group["variantCount"]) for group in parent_groups) / len(parent_groups) if parent_groups else 0.0
        ),
        "variants_per_parent_intent_max": max((int(group["variantCount"]) for group in parent_groups), default=0),
        "single_variant_intent_rate": (
            (len(usable_clusters) - sum(variant_name_counts.values())) / len(usable_clusters)
            if usable_clusters
            else 0.0
        ),
        "representative_case_total": total_cases,
        "representative_case_avg_per_intent": (total_cases / intent_count) if intent_count > 0 else 0.0,
        "intents_with_zero_cases": zero_case_count,
    }
    return intents, metrics


def _parent_intent_groups(clusters: list[dict[str, Any]]) -> list[dict[str, Any]]:
    label_counts = Counter(_intent_base_name(cluster, cluster.get("cluster_id")) for cluster in clusters)
    duplicate_labels = {label for label, count in label_counts.items() if label and count > 1}
    groups: list[dict[str, Any]] = []
    seen: set[str] = set()
    for cluster in clusters:
        label = _intent_base_name(cluster, cluster.get("cluster_id"))
        if label not in duplicate_labels or label in seen:
            continue
        seen.add(label)
        children = [item for item in clusters if _intent_base_name(item, item.get("cluster_id")) == label]
        cluster_ids = [item.get("cluster_id") for item in children]
        member_ids: list[str] = []
        exemplar_ids: list[str] = []
        for child in children:
            member_ids.extend(_cluster_member_ids(child))
            exemplar_ids.extend(_string_list(child.get("exemplar_conv_ids"), limit=10))
        groups.append(
            {
                "code": f"PARENT_INTENT_{len(groups)}",
                "name": label,
                "clusterIds": cluster_ids,
                "clusterSize": len(dict.fromkeys(member_ids)),
                "memberIds": list(dict.fromkeys(member_ids)),
                "exemplarConvIds": list(dict.fromkeys(exemplar_ids)),
                "variantCount": len(children),
                "variantIntentCodes": [f"INTENT_{item.get('cluster_id')}" for item in children],
            }
        )
    return groups


def _intent_base_name(cluster: dict[str, Any], cluster_id: Any) -> str:
    value = cluster.get("canonical_intent") or cluster.get("suggested_name") or f"INTENT_{cluster_id}"
    return str(value).strip() or f"INTENT_{cluster_id}"


def _variant_index(parent_group: dict[str, Any] | None, cluster_id: Any) -> int | None:
    if not parent_group:
        return None
    cluster_ids = list(parent_group.get("clusterIds") or [])
    try:
        return cluster_ids.index(cluster_id) + 1
    except ValueError:
        return None


def _workflow_variant_name(cluster: dict[str, Any], variant_index: int | None) -> str:
    raw_signal = cluster.get("workflow_signal")
    signal: dict[str, Any] = raw_signal if isinstance(raw_signal, dict) else {}
    flags: list[str] = []
    if signal.get("requires_user_identification") is True:
        flags.append("본인확인")
    if signal.get("requires_payment_check") is True:
        flags.append("결제확인")
    if signal.get("has_escalation_cases") is True:
        flags.append("이관")
    split_key = str(cluster.get("flow_split_key") or "").strip()
    split_label = _variant_label_from_split_key(split_key)
    if split_label:
        flags.extend(label for label in split_label.split("·") if label)
    if not flags:
        flags.append("일반")
    suffix = "·".join(dict.fromkeys(flags))
    if variant_index is not None:
        suffix = f"{suffix} 변형 {variant_index}"
    return suffix


def _variant_label_from_split_key(split_key: str) -> str:
    if not split_key or split_key in {"single_flow", "mixed_flow"}:
        return ""
    if "|" in split_key:
        labels = [_variant_label_from_split_key(part.strip()) for part in split_key.split("|")]
        return "·".join(dict.fromkeys(label for label in labels if label))
    if split_key == "no_signal":
        return ""
    if split_key == "mixed_residual":
        return "잔여"
    if split_key in {"requires_payment_check", "payment_check"}:
        return "결제확인"
    if split_key in {"requires_user_identification", "user_identification"}:
        return "본인확인"
    if split_key in {"has_escalation_cases", "escalation"}:
        return "이관"
    if "+" in split_key and split_key.startswith("requires_"):
        labels = [_variant_label_from_split_key(part.strip()) for part in split_key.split("+")]
        return "·".join(dict.fromkeys(label for label in labels if label))
    if split_key.startswith("action_object "):
        return split_key.removeprefix("action_object ").replace(">", " ").strip()
    if split_key.startswith("action_object:"):
        return split_key.removeprefix("action_object:").replace(">", " ")
    if split_key.startswith("sequence "):
        return split_key.removeprefix("sequence ").replace(">", " ").strip()
    if split_key.startswith("action:"):
        return f"{split_key.removeprefix('action:')} 처리"
    if split_key.startswith("sequence:"):
        events = [event for event in split_key.removeprefix("sequence:").split(">") if event]
        return "·".join(events[:3])
    return split_key.replace(":", " ").replace(">", " ")


def _unique_intent_name(name: str, used_names: set[str]) -> str:
    if name not in used_names:
        used_names.add(name)
        return name
    base = name
    index = 2
    while f"{base} {index}" in used_names:
        index += 1
    unique = f"{base} {index}"
    used_names.add(unique)
    return unique


def _representative_cases_for_member_ids(
    member_ids: list[str],
    preprocessed_index: dict[str, dict[str, Any]],
    limit: int,
) -> list[dict[str, Any]]:
    if limit <= 0:
        return []
    return [
        _hydrate_case(preprocessed_index[conv_id]) for conv_id in member_ids[:limit] if conv_id in preprocessed_index
    ]


def _cluster_member_ids(cluster: dict[str, Any]) -> list[str]:
    for key in ("segment_ids", "member_conv_ids", "memberConversationIds"):
        values = _string_list(cluster.get(key), limit=10_000)
        if values:
            return values
    return []


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


def _segment_details(value: Any, preprocessed_index: dict[str, dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    details: list[dict[str, Any]] = []
    for segment_id in _string_list(value, limit=limit):
        conv = preprocessed_index.get(segment_id)
        if not isinstance(conv, dict):
            continue
        item = _caselet_benchmark_details(conv)
        if item:
            details.append(item)
    return details


def _hydrate_case(conv: dict[str, Any]) -> dict[str, Any]:
    case = {
        "conversationId": conv.get("id", ""),
        "canonicalText": conv.get("canonical_text", ""),
        "customerProblemText": conv.get("customer_problem_text", ""),
        "endedStatus": conv.get("ended_status"),
    }
    case.update(_caselet_benchmark_details(conv))
    return case


def _caselet_benchmark_details(conv: dict[str, Any]) -> dict[str, Any]:
    details: dict[str, Any] = {}
    caselet_id = conv.get("id")
    if isinstance(caselet_id, str) and caselet_id:
        details["caseletId"] = caselet_id
    metadata = conv.get("metadata")
    if not isinstance(metadata, dict):
        metadata = {}
    source_conversation_id = conv.get("source_conversation_id") or metadata.get("sourceConversationId")
    if isinstance(source_conversation_id, str) and source_conversation_id:
        details["sourceConversationId"] = source_conversation_id
    for output_key, snake_key, metadata_key in (
        ("turnStart", "turn_start", "turnStart"),
        ("turnEnd", "turn_end", "turnEnd"),
    ):
        value = conv.get(snake_key, metadata.get(metadata_key))
        if isinstance(value, int) and not isinstance(value, bool):
            details[output_key] = value
    evidence_turn_ids = conv.get("evidence_turn_ids") or metadata.get("evidenceTurnIds")
    if isinstance(evidence_turn_ids, (list, tuple)):
        details["evidenceTurnIds"] = [item for item in evidence_turn_ids if isinstance(item, str) and item]
    action_object_frame = conv.get("action_object_frame") or metadata.get("actionObjectFrame")
    if isinstance(action_object_frame, dict):
        details["actionObjectFrame"] = action_object_frame
    flow_events = conv.get("flow_events")
    if isinstance(flow_events, (list, tuple)):
        details["flowEvents"] = [item for item in flow_events if isinstance(item, str) and item]
    return details


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
    preprocessed_index: dict[str, dict[str, Any]] | None = None,
    policy_ref: str | None = DUMMY_POLICY_CODE,
    slot_refs: list[str] | None = None,
    policy_names_by_code: dict[str, str] | None = None,
    slot_names_by_code: dict[str, str] | None = None,
    risk_refs: list[str] | None = None,
    risk_names_by_code: dict[str, str] | None = None,
) -> ProcessedWorkflow | None:
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
        policy_ref=policy_ref,
        workflow_events=_cluster_workflow_events(cluster, preprocessed_index or {}),
    )
    path_cases = _cluster_workflow_path_cases(cluster, preprocessed_index or {})
    graph_spec = (
        frequent_path_generator(context, path_cases) if len(path_cases) >= 2 else signal_based_generator(context)
    )
    workflow_path_support = graph_transition_coverage(path_cases, graph_spec)
    workflow_replay_fitness = workflow_path_support
    workflow_precision = graph_transition_precision(path_cases, graph_spec)
    review_only_reasons = _review_only_reason_codes(len(path_cases), workflow_path_support)
    route_condition = _route_condition(
        cluster,
        preprocessed_index or {},
        path_case_count=len(path_cases),
        workflow_path_support=workflow_path_support,
        review_only_reasons=review_only_reasons,
    )
    graph_spec = _enrich_graph_with_controls(
        graph_spec,
        cluster_id=cluster_id,
        route_condition=route_condition,
        policy_ref=policy_ref or DUMMY_POLICY_CODE,
        policy_name=(policy_names_by_code or {}).get(policy_ref or DUMMY_POLICY_CODE),
        slot_refs=slot_refs or [],
        slot_names_by_code=slot_names_by_code or {},
        risk_refs=risk_refs or [],
        risk_names_by_code=risk_names_by_code or {},
    )
    workflow_specificity = graph_event_specificity(path_cases, graph_spec)
    graph_specific_metrics = _graph_specificity_metrics(graph_spec, slot_refs or [], risk_refs or [])
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
        "description": _workflow_description(suggested_name, signal),
        "graphJson": serialize_graph_json(graph_spec),
        "evidenceJson": evidence_json_str,
        "metaJson": _compact_json(
            {
                "workflowMiningMethod": "frequent_path.v1" if len(path_cases) >= 2 else "signal_template.v1",
                "workflowPathSupport": workflow_path_support,
                "workflowPathSupportMethod": "graph_transition_coverage.v1",
                "workflowReplayFitness": workflow_replay_fitness,
                "workflowReplayFitnessMethod": "graph_transition_coverage.v1",
                "workflowPrecision": workflow_precision,
                "workflowPrecisionMethod": "graph_transition_precision.v1",
                "workflowSpecificity": workflow_specificity,
                "workflowSpecificityMethod": "graph_event_specificity.v2",
                "pathCaseCount": len(path_cases),
                "workflowConfidence": cluster.get("workflow_confidence"),
                "workflowConfidenceComponents": (
                    cluster.get("workflow_confidence_components")
                    if isinstance(cluster.get("workflow_confidence_components"), dict)
                    else {}
                ),
                "needsHumanReview": cluster.get("needs_human_review") is True,
                "reviewReasonCodes": (
                    cluster.get("review_reason_codes") if isinstance(cluster.get("review_reason_codes"), list) else []
                ),
                "sampleReviewReasonCodes": (
                    cluster.get("sample_review_reason_codes")
                    if isinstance(cluster.get("sample_review_reason_codes"), list)
                    else []
                ),
                "reviewTier": cluster.get("review_tier"),
                "coverageShare": cluster.get("coverage_share"),
                "reviewOnlyCandidate": bool(review_only_reasons),
                "reviewOnlyReasonCodes": review_only_reasons,
                "routeConditionConfidence": route_condition.get("confidence"),
            }
        ),
        "intentCode": f"INTENT_{cluster_id}",
        "isPrimary": True,
        "routeConditionJson": _compact_json(route_condition),
        "reviewStatus": (
            "needs_review" if cluster.get("needs_human_review") is True or review_only_reasons else "auto_acceptable"
        ),
    }
    return ProcessedWorkflow(
        workflow=workflow,
        keyword_count=kw_count,
        exemplar_count=ex_count,
        member_count=mb_count,
        is_empty_evidence=not evidence_items,
        signal=signal,
        path_support=workflow_path_support,
        precision=workflow_precision,
        specificity=workflow_specificity,
        graph_specific_metrics=graph_specific_metrics,
    )


def _workflow_description(suggested_name: str, signal: dict[str, bool]) -> str:
    checks: list[str] = []
    if signal.get("requires_user_identification"):
        checks.append("본인 확인")
    if signal.get("requires_payment_check"):
        checks.append("결제 확인")
    if signal.get("has_escalation_cases"):
        checks.append("상담원 이관")
    if checks:
        return f"{suggested_name}에 대해 {', '.join(checks)}을 포함해 처리합니다."
    return f"{suggested_name}에 대한 상담 요청을 처리합니다."


def _review_only_reason_codes(path_case_count: int, workflow_path_support: float) -> list[str]:
    reasons: list[str] = []
    if path_case_count < LOW_SUPPORT_REVIEW_ONLY_MIN_CASES:
        reasons.append("insufficient_path_case_count")
    if workflow_path_support < LOW_SUPPORT_REVIEW_ONLY_PATH_SUPPORT:
        reasons.append("low_path_support")
    return reasons


def _route_condition(
    cluster: dict[str, Any],
    preprocessed_index: dict[str, dict[str, Any]],
    *,
    path_case_count: int,
    workflow_path_support: float,
    review_only_reasons: list[str],
) -> dict[str, Any]:
    cluster_id = cluster.get("cluster_id")
    member_ids = _string_list(cluster.get("member_conv_ids"), limit=20)
    exemplar_ids = _string_list(cluster.get("exemplar_conv_ids"), limit=8)
    evidence_ids = _dedupe_strings([*exemplar_ids, *member_ids], limit=8)
    texts = _route_source_texts(cluster, preprocessed_index, member_ids, exemplar_ids)
    required_terms = _route_required_terms(cluster, texts)
    optional_terms = _route_optional_terms(cluster, texts, required_terms)
    action = _route_action(cluster, texts)
    label_score = _numeric_cluster_value(cluster, "label_score")
    workflow_confidence = _numeric_cluster_value(cluster, "workflow_confidence")
    confidence_values = [workflow_path_support]
    if label_score is not None:
        confidence_values.append(label_score)
    if workflow_confidence is not None:
        confidence_values.append(workflow_confidence)
    confidence = round(sum(confidence_values) / len(confidence_values), 4) if confidence_values else 0.0
    return {
        "schemaVersion": "route-condition.v1",
        "intentCode": f"INTENT_{cluster_id}",
        "workflowEntryPointId": cluster.get("workflow_entrypoint_id"),
        "requiredTerms": required_terms,
        "optionalTerms": optional_terms,
        "action": action,
        "negativeTerms": [],
        "pathCaseCount": path_case_count,
        "workflowPathSupport": workflow_path_support,
        "confidence": confidence,
        "evidenceConversationIds": evidence_ids,
        "executionEligibility": "review_only" if review_only_reasons else "candidate",
        "reviewOnlyReasonCodes": review_only_reasons,
        "source": "cluster_salience_action_object.v1",
    }


def _route_source_texts(
    cluster: dict[str, Any],
    preprocessed_index: dict[str, dict[str, Any]],
    member_ids: list[str],
    exemplar_ids: list[str],
) -> list[str]:
    texts = [
        str(cluster.get("suggested_name") or ""),
        str(cluster.get("canonical_intent") or ""),
    ]
    texts.extend(_string_list(cluster.get("keywords"), limit=10))
    texts.extend(_string_list(cluster.get("sample_intent_phrases"), limit=8, max_chars=120))
    texts.extend(_string_list(cluster.get("sample_segment_texts"), limit=5, max_chars=200))
    candidates = cluster.get("label_candidates")
    if isinstance(candidates, list):
        for candidate in candidates[:5]:
            if isinstance(candidate, dict):
                texts.append(str(candidate.get("name") or ""))
    action_frame = cluster.get("action_object_frame")
    if isinstance(action_frame, dict):
        texts.append(str(action_frame.get("object") or ""))
        texts.append(str(action_frame.get("action") or ""))
    for conv_id in _dedupe_strings([*exemplar_ids, *member_ids], limit=12):
        row = preprocessed_index.get(conv_id)
        if not isinstance(row, dict):
            continue
        texts.append(str(row.get("customer_problem_text") or row.get("canonical_text") or ""))
    return [text for text in texts if text.strip()]


def _route_required_terms(cluster: dict[str, Any], texts: list[str]) -> list[str]:
    del texts
    frame_terms: list[str] = []
    action_frame = cluster.get("action_object_frame")
    if isinstance(action_frame, dict):
        frame_terms.extend(_route_terms(str(action_frame.get("object") or "")))
    label_terms = _route_terms(str(cluster.get("suggested_name") or ""))
    strong_terms = _dedupe_strings(label_terms, limit=MAX_REQUIRED_ROUTE_TERMS)
    if strong_terms:
        return strong_terms
    strong_terms = _dedupe_strings(frame_terms, limit=MAX_REQUIRED_ROUTE_TERMS)
    if strong_terms:
        return strong_terms
    candidate_terms = _route_candidate_label_terms(cluster)
    strong_terms = _dedupe_strings(candidate_terms, limit=MAX_REQUIRED_ROUTE_TERMS)
    if strong_terms:
        return strong_terms
    fallback_counter = _route_term_counter(_route_salience_texts(cluster))
    fallback_terms = [
        term for term, count in fallback_counter.most_common() if count >= 2 and _is_route_term_quality(term)
    ]
    return _dedupe_strings(fallback_terms, limit=2)


def _route_optional_terms(cluster: dict[str, Any], texts: list[str], required_terms: list[str]) -> list[str]:
    required = set(required_terms)
    salience_counter = _route_term_counter(_route_salience_texts(cluster))
    raw_counter = _route_term_counter(texts)
    scored_terms: list[tuple[float, int, int, str]] = []
    for term in set(salience_counter) | set(raw_counter):
        if term in required or not _is_route_term_quality(term):
            continue
        salience_count = salience_counter[term]
        raw_count = raw_counter[term]
        if salience_count < 2:
            continue
        score = (2.0 * salience_count) + (0.35 * raw_count)
        scored_terms.append((score, salience_count, raw_count, term))
    scored_terms.sort(key=lambda item: (-item[0], -item[1], -item[2], item[3]))
    return [term for _score, _salience_count, _raw_count, term in scored_terms[:MAX_ROUTE_TERMS]]


def _route_salience_texts(cluster: dict[str, Any]) -> list[str]:
    texts = [
        str(cluster.get("suggested_name") or ""),
        str(cluster.get("canonical_intent") or ""),
    ]
    texts.extend(_string_list(cluster.get("keywords"), limit=12))
    candidates = cluster.get("label_candidates")
    if isinstance(candidates, list):
        for candidate in candidates[:5]:
            if isinstance(candidate, dict):
                texts.append(str(candidate.get("name") or ""))
    action_frame = cluster.get("action_object_frame")
    if isinstance(action_frame, dict):
        texts.append(str(action_frame.get("object") or ""))
        texts.append(str(action_frame.get("action") or ""))
    return [text for text in texts if text.strip()]


def _route_candidate_label_terms(cluster: dict[str, Any]) -> list[str]:
    candidates = cluster.get("label_candidates")
    if not isinstance(candidates, list):
        return []
    terms: list[str] = []
    for candidate in candidates[:3]:
        if not isinstance(candidate, dict):
            continue
        score = candidate.get("score")
        evidence_coverage = candidate.get("evidenceCoverage")
        if isinstance(score, (int, float)) and not isinstance(score, bool) and score < 0.50:
            continue
        if (
            isinstance(evidence_coverage, (int, float))
            and not isinstance(evidence_coverage, bool)
            and evidence_coverage < 0.20
        ):
            continue
        terms.extend(_route_terms(str(candidate.get("name") or "")))
    return terms


def _route_action(cluster: dict[str, Any], texts: list[str]) -> str | None:
    action_frame = cluster.get("action_object_frame")
    if isinstance(action_frame, dict):
        action = str(action_frame.get("action") or "").strip()
        if action:
            return action
    joined = " ".join(texts)
    for action in ACTION_ROUTE_TERMS:
        if action in joined:
            return action
    return None


def _route_term_counter(texts: list[str]) -> Counter[str]:
    counter: Counter[str] = Counter()
    for text in texts:
        counter.update(_route_terms(text))
    return counter


def _route_terms(text: str) -> list[str]:
    terms: list[str] = []
    for raw_term in re.findall(r"[0-9A-Za-z가-힣_]+", text.casefold()):
        term = _clean_route_term(raw_term)
        if not term:
            continue
        terms.append(term)
    return terms


def _clean_route_term(term: str) -> str:
    cleaned = term.strip().casefold()
    normalized_query_term = _normalize_route_query_term(cleaned)
    if normalized_query_term:
        return normalized_query_term
    if cleaned in ROUTE_TERM_STOPWORDS:
        return ""
    for _ in range(3):
        before = cleaned
        for suffix in (
            "해주세요",
            "해주실",
            "해주시면",
            "입니다",
            "합니다",
            "이에요",
            "예요",
            "았어요",
            "었어요",
            "았어",
            "었어",
            "았는데",
            "었는데",
            "인데요",
            "인데",
            "는데요",
            "는데",
            "하려고",
            "하려면",
            "하려",
            "할려고",
            "할려구",
            "할려",
            "할라",
            "할래",
            "하면",
            "하고",
            "해서",
            "되는지",
            "인가요",
            "입니까",
            "습니까",
            "나요",
            "거든요",
            "거든",
            "죠",
            "으로",
            "에서",
            "에게",
            "부터",
            "까지",
            "의",
            "로",
            "은",
            "는",
            "이",
            "가",
            "을",
            "를",
            "도",
            "에",
            "요",
            "았",
            "었",
            "해",
            "하",
        ):
            if cleaned.endswith(suffix) and len(cleaned) > len(suffix) + 1:
                cleaned = cleaned[: -len(suffix)]
                break
        if cleaned == before:
            break
    normalized_query_term = _normalize_route_query_term(cleaned)
    if normalized_query_term:
        return normalized_query_term
    if cleaned in ROUTE_TERM_STOPWORDS:
        return ""
    if not _is_route_term_quality(cleaned):
        return ""
    return cleaned


def _is_route_term_quality(cleaned: str) -> bool:
    if cleaned in ROUTE_TERM_STOPWORDS:
        return False
    if len(cleaned.replace("_", "")) <= 1 or any(char.isdigit() for char in cleaned):
        return False
    if re.fullmatch(r"[a-z]{1,3}", cleaned):
        return False
    return not any(
        marker in cleaned
        for marker in (
            "알겠",
            "여보",
            "부탁",
            "감사",
            "수고",
            "잠시",
            "잠깐",
            "모르겠",
            "여쭤",
            "그렇",
            "나왔",
            "언제쯤",
        )
    )


def _normalize_route_query_term(term: str) -> str:
    if term.startswith("얼마"):
        return "금액"
    if term.startswith("인출") or term.startswith("출금"):
        return "출금"
    if term.startswith("초과"):
        return "초과"
    return ""


def _enrich_graph_with_controls(
    graph_spec: WorkflowGraphSpec,
    *,
    cluster_id: int,
    route_condition: dict[str, Any],
    policy_ref: str,
    policy_name: str | None,
    slot_refs: list[str],
    slot_names_by_code: dict[str, str],
    risk_refs: list[str],
    risk_names_by_code: dict[str, str],
) -> WorkflowGraphSpec:
    nodes = list(graph_spec.nodes)
    edges = list(graph_spec.edges)
    start_edges = [edge for edge in edges if edge.from_node == "start"]
    non_start_edges = [edge for edge in edges if edge.from_node != "start"]
    route_node = GraphNodeSpec(
        id="route_check",
        type="DECISION",
        label="진입 조건 확인",
        evidence_refs=tuple(
            {"type": "route_term", "value": term} for term in route_condition.get("requiredTerms", [])[:5]
        ),
        support=route_condition.get("confidence") if isinstance(route_condition.get("confidence"), float) else None,
    )
    control_nodes: list[GraphNodeSpec] = [route_node]
    for index, slot_ref in enumerate(slot_refs[:MAX_CONTROL_SLOT_NODES], start=1):
        slot_name = slot_names_by_code.get(slot_ref, slot_ref)
        control_nodes.append(
            GraphNodeSpec(
                id=f"collect_slot_{index}",
                type="ACTION",
                label=f"슬롯 수집: {slot_name}",
                policy_ref=policy_ref,
                evidence_refs=({"type": "slot_ref", "value": slot_ref},),
                slot_ref=slot_ref,
            )
        )
    control_nodes.append(
        GraphNodeSpec(
            id="policy_control",
            type="ACTION",
            label=f"정책 확인: {policy_name or policy_ref}",
            policy_ref=policy_ref,
            evidence_refs=({"type": "policy_ref", "value": policy_ref},),
        )
    )
    for index, risk_ref in enumerate(risk_refs[:MAX_CONTROL_RISK_NODES], start=1):
        risk_name = risk_names_by_code.get(risk_ref, risk_ref)
        control_nodes.append(
            GraphNodeSpec(
                id=f"risk_check_{index}",
                type="ACTION",
                label=f"위험 확인: {risk_name}",
                policy_ref=policy_ref,
                evidence_refs=({"type": "risk_ref", "value": risk_ref},),
                risk_ref=risk_ref,
            )
        )
    control_edges: list[GraphEdgeSpec] = []
    previous = "start"
    edge_index = 1
    for node in control_nodes:
        control_edges.append(
            GraphEdgeSpec(
                id=f"control_{cluster_id}_{edge_index}",
                from_node=previous,
                to_node=node.id,
                label="matched" if node.id == "route_check" else "control",
                support=route_condition.get("confidence") if node.id == "route_check" else None,
            )
        )
        previous = node.id
        edge_index += 1
    target_edges = start_edges or [
        GraphEdgeSpec(id=f"control_{cluster_id}_target", from_node="start", to_node=_first_non_start_node_id(nodes))
    ]
    for target_edge in target_edges:
        if not target_edge.to_node or target_edge.to_node == "start":
            continue
        control_edges.append(
            GraphEdgeSpec(
                id=f"control_{cluster_id}_{edge_index}",
                from_node=previous,
                to_node=target_edge.to_node,
                label=target_edge.label or "observed",
                support=target_edge.support,
            )
        )
        edge_index += 1
    enriched_nodes = _dedupe_graph_nodes([*nodes, *control_nodes])
    return WorkflowGraphSpec(
        direction=graph_spec.direction,
        nodes=tuple(enriched_nodes),
        edges=tuple([*control_edges, *non_start_edges]),
    )


def _first_non_start_node_id(nodes: list[GraphNodeSpec]) -> str:
    for node in nodes:
        if node.id != "start":
            return node.id
    return "terminal"


def _dedupe_graph_nodes(nodes: list[GraphNodeSpec]) -> list[GraphNodeSpec]:
    output: list[GraphNodeSpec] = []
    seen: set[str] = set()
    for node in nodes:
        if node.id in seen:
            continue
        seen.add(node.id)
        output.append(node)
    return output


def _graph_specificity_metrics(
    graph_spec: WorkflowGraphSpec,
    slot_refs: list[str],
    risk_refs: list[str],
) -> dict[str, int | bool]:
    action_nodes = [node for node in graph_spec.nodes if node.type == "ACTION"]
    specific_action_nodes = [
        node
        for node in action_nodes
        if node.slot_ref is not None
        or node.risk_ref is not None
        or node.id == "policy_control"
        or node.label.startswith(("슬롯 수집:", "정책 확인:", "위험 확인:"))
    ]
    return {
        "has_specific_node": bool(specific_action_nodes),
        "has_slot_ref": any(node.slot_ref in slot_refs for node in action_nodes),
        "has_policy_control": any(node.id == "policy_control" for node in action_nodes),
        "has_risk_ref": any(node.risk_ref in risk_refs for node in action_nodes),
        "action_node_count": len(action_nodes),
        "specific_action_node_count": len(specific_action_nodes),
    }


def _slot_refs_by_intent(bindings: list[dict[str, Any]]) -> dict[str, list[str]]:
    refs: dict[str, list[str]] = {}
    for binding in bindings:
        intent_code = str(binding.get("intentCode") or "")
        slot_code = str(binding.get("slotCode") or "")
        if not intent_code or not slot_code:
            continue
        refs.setdefault(intent_code, [])
        if slot_code not in refs[intent_code]:
            refs[intent_code].append(slot_code)
    return refs


def _entity_refs_by_intent(items: list[dict[str, Any]], code_key: str) -> dict[str, list[str]]:
    refs: dict[str, list[str]] = {}
    for item in items:
        code = str(item.get(code_key) or "")
        if not code:
            continue
        condition = _json_object(item.get("conditionJson"))
        intent_codes = condition.get("intentCodes")
        if not isinstance(intent_codes, list):
            primary = condition.get("primaryIntentCode")
            intent_codes = [primary] if isinstance(primary, str) else []
        for intent_code_value in intent_codes:
            if not isinstance(intent_code_value, str) or not intent_code_value:
                continue
            refs.setdefault(intent_code_value, [])
            if code not in refs[intent_code_value]:
                refs[intent_code_value].append(code)
    return refs


def _name_by_code(items: list[dict[str, Any]], code_key: str) -> dict[str, str]:
    output: dict[str, str] = {}
    for item in items:
        code = item.get(code_key)
        name = item.get("name")
        if isinstance(code, str) and isinstance(name, str):
            output[code] = name
    return output


def _json_object(value: object) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if not isinstance(value, str) or not value.strip():
        return {}
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _has_route_condition(workflow: dict[str, Any]) -> bool:
    route = _json_object(workflow.get("routeConditionJson"))
    return bool(route.get("requiredTerms")) or bool(route.get("action"))


def _is_review_only_workflow(workflow: dict[str, Any]) -> bool:
    meta = _json_object(workflow.get("metaJson"))
    return meta.get("reviewOnlyCandidate") is True


def _numeric_cluster_value(cluster: dict[str, Any], key: str) -> float | None:
    value = cluster.get(key)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    return None


def _dedupe_strings(values: list[str], *, limit: int) -> list[str]:
    output: list[str] = []
    seen: set[str] = set()
    for value in values:
        if not isinstance(value, str):
            continue
        normalized = value.strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        output.append(normalized)
        if len(output) >= limit:
            break
    return output


def _build_workflow_draft(
    clusters: list[dict[str, Any]],
    preprocessed_index: dict[str, dict[str, Any]] | None = None,
    policy_refs_by_cluster: dict[int, str] | None = None,
    slots: list[dict[str, Any]] | None = None,
    intent_slot_bindings: list[dict[str, Any]] | None = None,
    policies: list[dict[str, Any]] | None = None,
    risks: list[dict[str, Any]] | None = None,
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
    workflow_path_support_total = 0.0
    workflow_precision_total = 0.0
    workflow_specificity_total = 0.0
    route_condition_count = 0
    workflows_with_specific_nodes = 0
    workflows_with_slot_refs = 0
    workflows_requiring_slot_refs = 0
    workflows_with_policy_control = 0
    workflows_with_risk_refs = 0
    workflows_requiring_risk_refs = 0
    review_only_count = 0
    action_node_total = 0
    specific_action_node_total = 0
    slot_refs_by_intent = _slot_refs_by_intent(intent_slot_bindings or [])
    slot_names_by_code = _name_by_code(slots or [], "slotCode")
    policy_names_by_code = _name_by_code(policies or [], "policyCode")
    risk_names_by_code = _name_by_code(risks or [], "riskCode")
    risk_refs_by_intent = _entity_refs_by_intent(risks or [], "riskCode")

    for cluster in clusters:
        cluster_id = cluster.get("cluster_id") if isinstance(cluster, dict) else None
        intent_code = f"INTENT_{cluster_id}" if isinstance(cluster_id, int) else ""
        policy_ref = (
            policy_refs_by_cluster.get(cluster_id)
            if isinstance(cluster_id, int) and policy_refs_by_cluster is not None
            else DUMMY_POLICY_CODE
        )
        slot_refs = slot_refs_by_intent.get(intent_code, [])
        risk_refs = risk_refs_by_intent.get(intent_code, [])
        result = _process_cluster_entry(
            cluster,
            preprocessed_index=preprocessed_index,
            policy_ref=policy_ref,
            slot_refs=slot_refs,
            policy_names_by_code=policy_names_by_code,
            slot_names_by_code=slot_names_by_code,
            risk_refs=risk_refs,
            risk_names_by_code=risk_names_by_code,
        )
        if result is None:
            continue
        workflows.append(result.workflow)
        keyword_total += result.keyword_count
        exemplar_total += result.exemplar_count
        member_total += result.member_count
        empty_evidence_count += result.is_empty_evidence
        workflow_path_support_total += result.path_support
        workflow_precision_total += result.precision
        workflow_specificity_total += result.specificity
        route_condition_count += _has_route_condition(result.workflow)
        workflows_with_specific_nodes += bool(result.graph_specific_metrics["has_specific_node"])
        workflows_with_slot_refs += bool(result.graph_specific_metrics["has_slot_ref"])
        workflows_requiring_slot_refs += bool(slot_refs)
        workflows_with_policy_control += bool(result.graph_specific_metrics["has_policy_control"])
        workflows_with_risk_refs += bool(result.graph_specific_metrics["has_risk_ref"])
        workflows_requiring_risk_refs += bool(risk_refs)
        review_only_count += _is_review_only_workflow(result.workflow)
        action_node_total += int(result.graph_specific_metrics["action_node_count"])
        specific_action_node_total += int(result.graph_specific_metrics["specific_action_node_count"])
        workflow_count += 1
        identify_count += bool(result.signal.get("requires_user_identification"))
        payment_count += bool(result.signal.get("requires_payment_check"))
        escalation_count += bool(result.signal.get("has_escalation_cases"))

    draft = WorkflowDraftArtifact(
        slots=[],
        policies=[] if policy_refs_by_cluster is not None else [_default_dummy_policy()],
        risks=[],
        workflows=workflows,
        intent_slot_bindings=[],
    )
    workflow_metrics = {
        "workflow_count": workflow_count,
        "workflow_with_identify_count": identify_count,
        "workflow_with_payment_check_count": payment_count,
        "workflow_with_escalation_count": escalation_count,
        "workflow_evidence_keyword_total": keyword_total,
        "workflow_evidence_exemplar_total": exemplar_total,
        "workflow_evidence_member_total": member_total,
        "workflow_with_empty_evidence_count": empty_evidence_count,
        "workflow_path_support": workflow_path_support_total / workflow_count if workflow_count else 0.0,
        "workflow_replay_fitness": workflow_path_support_total / workflow_count if workflow_count else 0.0,
        "workflow_precision": workflow_precision_total / workflow_count if workflow_count else 0.0,
        "workflow_specificity": workflow_specificity_total / workflow_count if workflow_count else 0.0,
        "route_condition_coverage": route_condition_count / workflow_count if workflow_count else 0.0,
        "specific_node_ratio": specific_action_node_total / action_node_total if action_node_total else 0.0,
        "workflow_with_specific_node_rate": workflows_with_specific_nodes / workflow_count if workflow_count else 0.0,
        "slot_node_coverage": (
            workflows_with_slot_refs / workflows_requiring_slot_refs if workflows_requiring_slot_refs else 1.0
        ),
        "policy_node_coverage": workflows_with_policy_control / workflow_count if workflow_count else 0.0,
        "risk_node_coverage": (
            workflows_with_risk_refs / workflows_requiring_risk_refs if workflows_requiring_risk_refs else 1.0
        ),
        "review_only_workflow_count": review_only_count,
        "low_support_workflow_rate": review_only_count / workflow_count if workflow_count else 0.0,
    }
    return draft.to_json_dict(), workflow_metrics


def _cluster_workflow_events(
    cluster: dict[str, Any],
    preprocessed_index: dict[str, dict[str, Any]],
) -> tuple[str, ...]:
    if not preprocessed_index:
        return ()
    sequences: list[list[str]] = []
    ordered_ids = _string_list(cluster.get("exemplar_conv_ids"), limit=10) + _string_list(
        cluster.get("member_conv_ids"),
        limit=60,
    )
    seen: set[str] = set()
    for conv_id in ordered_ids:
        if conv_id in seen:
            continue
        seen.add(conv_id)
        conversation = preprocessed_index.get(conv_id)
        if not isinstance(conversation, dict):
            continue
        events = conversation.get("flow_events")
        if not isinstance(events, list):
            continue
        collapsed = _collapse_events([str(event) for event in events if isinstance(event, str)])
        if collapsed:
            sequences.append(collapsed)
    return _dominant_event_sequence(sequences)


def _cluster_workflow_path_cases(
    cluster: dict[str, Any],
    preprocessed_index: dict[str, dict[str, Any]],
) -> list[tuple[list[str], str | None]]:
    if not preprocessed_index:
        return []
    output: list[tuple[list[str], str | None]] = []
    ordered_ids = _string_list(cluster.get("exemplar_conv_ids"), limit=10) + _string_list(
        cluster.get("member_conv_ids"),
        limit=80,
    )
    seen: set[str] = set()
    for conv_id in ordered_ids:
        if conv_id in seen:
            continue
        seen.add(conv_id)
        conversation = preprocessed_index.get(conv_id)
        if not isinstance(conversation, dict):
            continue
        events = conversation.get("flow_events")
        if not isinstance(events, list):
            continue
        collapsed = _collapse_events([str(event) for event in events if isinstance(event, str)])
        if collapsed:
            outcome = conversation.get("ended_status")
            output.append((collapsed, outcome if isinstance(outcome, str) else None))
    return output


def _collapse_events(events: list[str]) -> list[str]:
    output: list[str] = []
    for event in events:
        if event and (not output or output[-1] != event):
            output.append(event)
    return output


def _dominant_event_sequence(sequences: list[list[str]], max_events: int = 5) -> tuple[str, ...]:
    if not sequences:
        return ()
    sequence_count = len(sequences)
    max_length = min(max((len(sequence) for sequence in sequences), default=0), max_events)
    output: list[str] = []
    for position in range(max_length):
        counts: dict[str, int] = {}
        for sequence in sequences:
            if position >= len(sequence):
                continue
            event = sequence[position]
            counts[event] = counts.get(event, 0) + 1
        if not counts:
            continue
        event, count = max(counts.items(), key=lambda item: (item[1], item[0]))
        if count < max(2, int(sequence_count * 0.15)):
            continue
        if output and output[-1] == event:
            continue
        output.append(event)
    if output:
        return tuple(output)
    fallback_counts: dict[str, int] = {}
    for sequence in sequences:
        for event in sequence:
            fallback_counts[event] = fallback_counts.get(event, 0) + 1
    return tuple(event for event, _count in sorted(fallback_counts.items(), key=lambda item: (-item[1], item[0]))[:3])


def _build_slot_draft(
    clusters: list[dict[str, Any]],
    preprocessed_index: dict[str, dict[str, Any]] | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    """cluster.workflow_signal 기반으로 slots + intentSlotBindings 도출.

    Returns:
        (slots, intentSlotBindings, metrics)
    """
    if preprocessed_index is not None:
        evidence_slots, evidence_bindings, evidence_metrics = build_evidence_based_slot_draft(
            clusters,
            preprocessed_index,
        )
        if not evidence_slots and not preprocessed_index:
            return _build_slot_draft(clusters)
        evidence_metrics.update(
            {
                "signal_slot_hit_payment_check": 0,
                "signal_slot_hit_user_identification": 0,
                "signal_slot_hit_escalation": 0,
            }
        )
        return evidence_slots, evidence_bindings, evidence_metrics

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
        "slot_with_evidence_count": 0,
        "slot_evidence_coverage": 1 if len(slots) == 0 else 0,
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
    candidate = DraftGenerationCandidateArtifact(
        domain_pack_draft=domain_pack_draft,
        intents=intents,
        workflow_draft=WorkflowDraftArtifact.from_payload(workflow_draft),
        evaluation_inputs=evaluation_inputs or {},
    )
    return candidate.to_json_dict()


def _write_candidate(
    stage_context: StageContext,
    runtime_config: PipelineRuntimeConfig,
    candidate: dict[str, Any],
) -> Path:
    output_dir = ensure_stage_directory(stage_context, runtime_config)
    candidate_path = output_dir / DEFAULT_CANDIDATE_ARTIFACT
    candidate_path.write_text(json.dumps(candidate, indent=2, ensure_ascii=False), encoding="utf-8")
    return candidate_path
