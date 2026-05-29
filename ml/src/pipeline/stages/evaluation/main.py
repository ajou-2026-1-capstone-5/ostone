from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, cast

from pipeline.common.artifacts import ensure_stage_directory
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.exceptions import PipelineConfigurationError, PipelineStageError
from pipeline.stages.preprocessing.io import read_stage_context

MAPPING_RATE_THRESHOLD = 0.75
OUTLIER_RATE_THRESHOLD = 0.25
WORKFLOW_SEPARABILITY_THRESHOLD = 0.65
EVIDENCE_COVERAGE_THRESHOLD = 0.80
EVIDENCE_SUFFICIENCY_THRESHOLD = 0.80
EVIDENCE_SUFFICIENCY_UNSUPPORTED_FIELD_LIMIT = 20
SLOT_EVIDENCE_COVERAGE_THRESHOLD = 0.80
POLICY_COVERAGE_THRESHOLD = 0.80
RISK_COVERAGE_THRESHOLD = 0.80
LLM_SCHEMA_VALIDITY_THRESHOLD = 0.95
DEFAULT_DEV_EVIDENCE_JSON = '[{"conversationId":"development-default","turnIds":[]}]'
CLUSTER_STABILITY_THRESHOLD = 0.70
CLUSTER_DISTINCTIVENESS_THRESHOLD = 0.45
LABEL_FIDELITY_THRESHOLD = 0.65
WORKFLOW_PATH_SUPPORT_THRESHOLD = 0.60
LABEL_MEMBER_EVIDENCE_COVERAGE_REVIEW_THRESHOLD = 0.70
LABEL_MEMBER_EVIDENCE_COVERAGE_BLOCK_THRESHOLD = 0.40
LABEL_OBJECT_ACTION_JOINT_COVERAGE_REVIEW_THRESHOLD = 0.65
LABEL_OBJECT_ACTION_JOINT_COVERAGE_BLOCK_THRESHOLD = 0.35
WORKFLOW_REPLAY_FITNESS_REVIEW_THRESHOLD = 0.70
WORKFLOW_REPLAY_FITNESS_BLOCK_THRESHOLD = 0.50
WORKFLOW_PRECISION_REVIEW_THRESHOLD = 0.55
WORKFLOW_PRECISION_BLOCK_THRESHOLD = 0.35
WORKFLOW_SPECIFICITY_REVIEW_THRESHOLD = 0.40
WORKFLOW_SPECIFICITY_BLOCK_THRESHOLD = 0.20
SAME_INTENT_OVERMERGE_RISK_REVIEW_THRESHOLD = 0.20
SAME_INTENT_OVERMERGE_RISK_BLOCK_THRESHOLD = 0.35
ROUTE_CONDITION_COVERAGE_THRESHOLD = 0.75
POLICY_NODE_COVERAGE_THRESHOLD = 0.75
RISK_NODE_COVERAGE_THRESHOLD = 0.75
AUTO_REVIEW_REQUIRED_RATE_THRESHOLD = 0.15
AUTO_DUPLICATE_LABEL_RATE_THRESHOLD = 0.03
AUTO_WORKFLOW_CONFIDENCE_AVG_THRESHOLD = 0.82
AUTO_WORKFLOW_CONFIDENCE_MIN_THRESHOLD = 0.65
REQUIRED_NUMERIC_METRICS = (
    "outlierRate",
    "workflowSeparability",
    "slotEvidenceCoverage",
    "policyCoverage",
    "riskCoverage",
    "semanticClusterCohesion",
    "semanticSeparationMargin",
    "clusterDistinctiveness",
    "clusterStability",
    "labelFidelity",
    "labelMemberEvidenceCoverage",
    "labelObjectActionJointCoverage",
    "workflowPathSupport",
    "workflowReplayFitness",
    "workflowPrecision",
    "workflowSpecificity",
    "sameIntentOvermergeRisk",
)
BENCHMARK_MUST_LINK_RECALL_REVIEW_THRESHOLD = 0.60
BENCHMARK_CANNOT_LINK_VIOLATION_THRESHOLD = 0.0
BENCHMARK_BOUNDARY_RECALL_REVIEW_THRESHOLD = 0.70
BENCHMARK_LABEL_JOINT_ACCURACY_REVIEW_THRESHOLD = 0.60
BENCHMARK_WORKFLOW_EVENT_RECALL_REVIEW_THRESHOLD = 0.60
BENCHMARK_FORBIDDEN_KEYS = frozenset(
    {
        "category",
        "categories",
        "consulting_category",
        "consultingCategory",
        "expected_label",
        "expected_labels",
        "expectedLabel",
        "expectedLabels",
        "gold_category",
        "goldCategory",
        "label",
        "labels",
    }
)
BENCHMARK_RELATION_MAP = {
    "must_link": "must_link",
    "same_intent": "must_link",
    "same_parent_intent_different_workflow_variant": "must_link",
    "cannot_link": "cannot_link",
    "different_intent_same_object": "cannot_link",
    "same_workflow_pattern_different_intent": "cannot_link",
    "noise_or_filler": "cannot_link",
}
WORKFLOW_EVENT_TERM_ALIASES = {
    "확인질문": ("요청 내용 확인", "진입 조건 확인", "요청확인"),
    "추가정보요청": ("필요 정보 수집", "슬롯 수집", "정보수집"),
    "정책안내": ("정책 확인", "처리 기준 확인", "기준확인", "policy_ref"),
    "불만표현": ("문제 상황 확인", "문제확인"),
    "예외처리": ("예외 처리 검토", "예외검토"),
    "해결": ("처리 결과 안내", "결과안내", "종료", "resolved"),
    "이관": ("상담원 연결", "상담원이관", "handoff", "escalated"),
}
BENCHMARK_RELATIONS = frozenset(BENCHMARK_RELATION_MAP)
EMPTY_BENCHMARK_SUITE: dict[str, Any] = {
    "schemaVersion": "evaluation-benchmark-suite.v1",
    "intentPairs": [],
    "boundaryCases": [],
    "labelExpectations": [],
    "workflowExpectations": [],
}


def run(upstream_manifest_path: str | None = None) -> dict[str, object]:
    if upstream_manifest_path is None:
        raise PipelineConfigurationError("evaluation stage requires an upstream manifest path.")
    runtime_config = PipelineRuntimeConfig.from_env()
    stage_context = read_stage_context(upstream_manifest_path, stage_name="evaluation")
    stage_dir = ensure_stage_directory(stage_context, runtime_config)
    candidate = _load_or_create_candidate(upstream_manifest_path)
    benchmark = _load_evaluation_benchmark(upstream_manifest_path)
    candidate["evaluationSummary"] = _evaluate_candidate(candidate, benchmark=benchmark)

    candidate_path = stage_dir / "publish_candidate_input.json"
    candidate_path.write_text(json.dumps(candidate, indent=2, ensure_ascii=False), encoding="utf-8")
    return {
        "candidateArtifactPath": str(candidate_path.resolve()),
        "evaluation_summary": candidate.get("evaluationSummary"),
    }


def _load_or_create_candidate(upstream_manifest_path: str) -> dict[str, Any]:
    manifest_path = Path(upstream_manifest_path)
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise PipelineStageError(f"Failed to read upstream manifest: {manifest_path}") from exc
    except json.JSONDecodeError as exc:
        raise PipelineStageError(f"Invalid upstream manifest JSON: {manifest_path}") from exc

    if not isinstance(manifest, dict):
        raise PipelineStageError(f"Upstream manifest must be a JSON object: {manifest_path}")

    payload = manifest.get("payload")
    candidate_path_value = _payload_str(payload, "candidateArtifactPath") or _payload_str(
        payload, "candidate_artifact_path"
    )
    if candidate_path_value:
        candidate_path = _resolve_path(manifest_path, candidate_path_value)
        try:
            candidate = json.loads(candidate_path.read_text(encoding="utf-8"))
        except OSError as exc:
            raise PipelineStageError(f"Failed to read candidate artifact: {candidate_path}") from exc
        except json.JSONDecodeError as exc:
            raise PipelineStageError(f"Invalid candidate artifact JSON: {candidate_path}") from exc
        if not isinstance(candidate, dict):
            raise PipelineStageError(f"Candidate artifact must be a JSON object: {candidate_path}")
        return cast(dict[str, Any], candidate)

    return _build_development_candidate()


def _load_evaluation_benchmark(upstream_manifest_path: str) -> dict[str, Any] | None:
    path = _evaluation_benchmark_path(upstream_manifest_path)
    if path is None:
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise PipelineStageError(f"Failed to read evaluation benchmark: {path}") from exc
    except json.JSONDecodeError as exc:
        raise PipelineStageError(f"Invalid evaluation benchmark JSON: {path}") from exc
    return _parse_benchmark_suite(payload, path)


def _evaluation_benchmark_path(upstream_manifest_path: str) -> Path | None:
    env_value = os.getenv("PIPELINE_EVALUATION_BENCHMARK_PATH", "").strip()
    if env_value:
        return Path(env_value)
    manifest_path = Path(upstream_manifest_path)
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(manifest, dict):
        return None
    payload = manifest.get("payload")
    path_value = _payload_str(payload, "evaluationBenchmarkPath") or _payload_str(payload, "evaluation_benchmark_path")
    return _resolve_path(manifest_path, path_value) if path_value else None


def _parse_pairwise_benchmark(payload: object, path: Path | None = None) -> list[dict[str, object]]:
    return _parse_benchmark_suite(payload, path)["intentPairs"]


def _parse_benchmark_suite(payload: object, path: Path | None = None) -> dict[str, Any]:
    forbidden_path = _find_forbidden_benchmark_key(payload)
    if forbidden_path is not None:
        location = f" in {path}" if path is not None else ""
        raise PipelineStageError(
            f"Evaluation benchmark must not contain unavailable metadata{location}: {forbidden_path}"
        )
    if isinstance(payload, dict):
        rows = payload.get("pairs") or payload.get("intentPairs")
        boundary_cases = _benchmark_object_list(payload.get("boundaryCases"), "boundaryCases")
        label_expectations = _benchmark_object_list(payload.get("labelExpectations"), "labelExpectations")
        workflow_expectations = _benchmark_object_list(payload.get("workflowExpectations"), "workflowExpectations")
        if rows is None and (boundary_cases or label_expectations or workflow_expectations):
            rows = []
    else:
        rows = payload
        boundary_cases = []
        label_expectations = []
        workflow_expectations = []
    if not isinstance(rows, list):
        raise PipelineStageError("Evaluation benchmark must be a list or an object with a pairs/intentPairs list.")
    pairs: list[dict[str, object]] = []
    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            raise PipelineStageError(f"Evaluation benchmark pair must be an object: index={index}")
        source_id = _benchmark_id(row, "source")
        target_id = _benchmark_id(row, "target")
        relation = _benchmark_relation(row)
        if source_id is None or target_id is None or relation is None:
            raise PipelineStageError(f"Invalid evaluation benchmark pair: index={index}")
        pairs.append(
            {
                "sourceId": source_id,
                "targetId": target_id,
                "relation": relation,
            }
        )
    return {
        "schemaVersion": "evaluation-benchmark-suite.v1",
        "intentPairs": pairs,
        "boundaryCases": [_normalize_boundary_case(row, index) for index, row in enumerate(boundary_cases)],
        "labelExpectations": [_normalize_label_expectation(row, index) for index, row in enumerate(label_expectations)],
        "workflowExpectations": [
            _normalize_workflow_expectation(row, index) for index, row in enumerate(workflow_expectations)
        ],
    }


def _benchmark_object_list(value: object, key: str) -> list[dict[str, object]]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise PipelineStageError(f"Evaluation benchmark {key} must be a list.")
    output: list[dict[str, object]] = []
    for index, item in enumerate(value):
        if not isinstance(item, dict):
            raise PipelineStageError(f"Evaluation benchmark {key}[{index}] must be an object.")
        output.append(cast(dict[str, object], item))
    return output


def _normalize_boundary_case(row: dict[str, object], index: int) -> dict[str, object]:
    conversation_id = row.get("conversationId")
    expected = row.get("expectedCaselets")
    if not isinstance(conversation_id, str) or not conversation_id.strip() or not isinstance(expected, list):
        raise PipelineStageError(f"Invalid evaluation benchmark boundary case: index={index}")
    expected_caselets: list[dict[str, object]] = []
    for case_index, caselet in enumerate(expected):
        if not isinstance(caselet, dict):
            raise PipelineStageError(
                f"Evaluation benchmark boundary caselet must be an object: index={index}.{case_index}"
            )
        turn_start = caselet.get("turnStart")
        turn_end = caselet.get("turnEnd")
        if not isinstance(turn_start, int) or isinstance(turn_start, bool):
            raise PipelineStageError(f"Invalid boundary turnStart: index={index}.{case_index}")
        if not isinstance(turn_end, int) or isinstance(turn_end, bool):
            raise PipelineStageError(f"Invalid boundary turnEnd: index={index}.{case_index}")
        expected_caselets.append(
            {
                "turnStart": turn_start,
                "turnEnd": turn_end,
                "issueObject": _optional_text(caselet.get("issueObject")),
                "issueAction": _optional_text(caselet.get("issueAction")),
            }
        )
    return {"conversationId": conversation_id.strip(), "expectedCaselets": expected_caselets}


def _normalize_label_expectation(row: dict[str, object], index: int) -> dict[str, object]:
    cluster_gold_id = row.get("clusterGoldId")
    issue_object = row.get("object")
    action = row.get("action")
    if (
        not isinstance(cluster_gold_id, str)
        or not cluster_gold_id.strip()
        or not isinstance(issue_object, str)
        or not issue_object.strip()
        or not isinstance(action, str)
        or not action.strip()
    ):
        raise PipelineStageError(f"Invalid evaluation benchmark label expectation: index={index}")
    return {
        "clusterGoldId": cluster_gold_id.strip(),
        "memberCaseletIds": _optional_str_list(row.get("memberCaseletIds")),
        "object": issue_object.strip(),
        "action": action.strip(),
        "allowedLabels": _optional_str_list(row.get("allowedLabels")),
        "forbiddenTerms": _optional_str_list(row.get("forbiddenTerms")),
    }


def _normalize_workflow_expectation(row: dict[str, object], index: int) -> dict[str, object]:
    caselet_id = row.get("caseletId")
    expected_events = row.get("expectedEvents")
    if not isinstance(caselet_id, str) or not caselet_id.strip() or not isinstance(expected_events, list):
        raise PipelineStageError(f"Invalid evaluation benchmark workflow expectation: index={index}")
    events = [item.strip() for item in expected_events if isinstance(item, str) and item.strip()]
    if not events:
        raise PipelineStageError(f"Invalid evaluation benchmark workflow expectedEvents: index={index}")
    return {
        "caseletId": caselet_id.strip(),
        "expectedEvents": events,
        "workflowVariant": _optional_text(row.get("workflowVariant")),
        "expectedBranchConditions": _optional_str_list(row.get("expectedBranchConditions")),
    }


def _optional_text(value: object) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _optional_str_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item.strip() for item in value if isinstance(item, str) and item.strip()]


def _benchmark_id(row: dict[str, object], prefix: str) -> str | None:
    keys = (
        f"{prefix}CaseletId",
        f"{prefix}_caselet_id",
        f"{prefix}ConversationId",
        f"{prefix}_conversation_id",
        f"{prefix}Id",
        f"{prefix}_id",
    )
    for key in keys:
        value = row.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _benchmark_relation(row: dict[str, object]) -> str | None:
    value = row.get("relation") or row.get("type")
    if not isinstance(value, str):
        return None
    relation = value.strip().lower()
    return BENCHMARK_RELATION_MAP.get(relation)


def _find_forbidden_benchmark_key(value: object, path: str = "$") -> str | None:
    if isinstance(value, dict):
        for key, child in value.items():
            key_text = str(key)
            child_path = f"{path}.{key_text}"
            if key_text in BENCHMARK_FORBIDDEN_KEYS:
                return child_path
            nested_path = _find_forbidden_benchmark_key(child, child_path)
            if nested_path is not None:
                return nested_path
    elif isinstance(value, list):
        for index, child in enumerate(value):
            nested_path = _find_forbidden_benchmark_key(child, f"{path}[{index}]")
            if nested_path is not None:
                return nested_path
    return None


def _build_development_candidate() -> dict[str, Any]:
    return {
        "schemaVersion": "1.0",
        "domainPackDraft": {
            "packKey": "local-smoke-pack",
            "packName": "Local Smoke Pack",
            "summaryJson": '{"source":"development-default"}',
        },
        "intentDraft": {
            "intents": [
                {
                    "intentCode": "general_inquiry",
                    "name": "General inquiry",
                    "description": "Development default intent for local pipeline smoke tests.",
                    "taxonomyLevel": 1,
                    "parentIntentCode": None,
                    "sourceClusterRef": '{"source":"development-default"}',
                    "entryConditionJson": "{}",
                    "evidenceJson": DEFAULT_DEV_EVIDENCE_JSON,
                    "metaJson": "{}",
                    "representativeCases": [],
                }
            ]
        },
        "workflowDraft": {
            "slots": [],
            "policies": [
                {
                    "policyCode": "default_policy",
                    "name": "Default policy",
                    "description": "Development default policy.",
                    "severity": "LOW",
                    "conditionJson": "{}",
                    "actionJson": "{}",
                    "evidenceJson": DEFAULT_DEV_EVIDENCE_JSON,
                    "metaJson": "{}",
                }
            ],
            "risks": [],
            "workflows": [
                {
                    "workflowCode": "default_flow",
                    "name": "Default flow",
                    "description": "Development default workflow.",
                    "graphJson": (
                        '{"direction":"LR","nodes":[{"id":"start","type":"START","label":"시작"},'
                        '{"id":"answer","type":"ACTION","label":"Default flow","policyRef":"default_policy"},'
                        '{"id":"terminal","type":"TERMINAL","label":"종료"}],'
                        '"edges":[{"id":"e1","from":"start","to":"answer"},'
                        '{"id":"e2","from":"answer","to":"terminal"}]}'
                    ),
                    "evidenceJson": DEFAULT_DEV_EVIDENCE_JSON,
                    "metaJson": "{}",
                    "intentCode": "general_inquiry",
                    "isPrimary": True,
                    "routeConditionJson": "{}",
                }
            ],
            "intentSlotBindings": [],
        },
        "evaluationSummary": {
            "passed": True,
            "mappingRate": None,
            "outlierRate": None,
            "workflowSeparability": None,
        },
        "evaluationInputs": {
            "outlierRate": 0.0,
            "workflowSeparability": 1.0,
            "slotEvidenceCoverage": 1.0,
            "policyCoverage": 1.0,
            "riskCoverage": 1.0,
            "semanticQualityFinal": True,
            "semanticClusterCohesion": 1.0,
            "semanticSeparationMargin": 1.0,
            "clusterDistinctiveness": 1.0,
            "positiveMarginRate": 1.0,
            "clusterStability": 1.0,
            "labelFidelity": 1.0,
            "labelMemberEvidenceCoverage": 1.0,
            "labelObjectCoverage": 1.0,
            "labelActionCoverage": 1.0,
            "labelObjectActionJointCoverage": 1.0,
            "workflowPathSupport": 1.0,
            "workflowReplayFitness": 1.0,
            "workflowPrecision": 1.0,
            "workflowSpecificity": 1.0,
            "sameIntentOvermergeRisk": 0.0,
        },
    }


def _payload_str(payload: object, key: str) -> str | None:
    if isinstance(payload, dict):
        value = payload.get(key)
        if isinstance(value, str) and value:
            return value
    return None


def _resolve_path(manifest_path: Path, path_value: str) -> Path:
    path = Path(path_value)
    if path.is_absolute():
        return path
    return manifest_path.parent / path


def _evaluate_candidate(
    candidate: dict[str, Any],
    benchmark: dict[str, Any] | list[dict[str, object]] | None = None,
) -> dict[str, Any]:
    workflows = _workflow_items(candidate)
    intents = _intent_items(candidate)
    slots = _slot_items(candidate)
    policies = _policy_items(candidate)
    risks = _risk_items(candidate)
    draft_entities = intents + workflows + slots + policies + risks

    block_reasons: list[str] = []
    quality_review_reasons: list[str] = []
    graph_validation_errors = _graph_validation_errors(workflows)
    graph_validity = "passed" if not graph_validation_errors else "failed"
    if graph_validity != "passed":
        block_reasons.append("graph_validity_failed")

    evidence_coverage = _evidence_coverage(draft_entities)
    if evidence_coverage < EVIDENCE_COVERAGE_THRESHOLD:
        block_reasons.append("evidence_coverage_below_threshold")
    evidence_sufficiency = _evidence_sufficiency_summary(intents, workflows, slots, policies, risks)
    if evidence_sufficiency["score"] < EVIDENCE_SUFFICIENCY_THRESHOLD:
        block_reasons.append("evidence_sufficiency_below_threshold")

    if _pii_redaction_failed(candidate):
        block_reasons.append("pii_redaction_failed")

    if _has_auto_confirmed_unsupported_policy_or_risk(policies + risks):
        block_reasons.append("unsupported_policy_or_risk")

    llm_schema_validity = _llm_schema_validity(candidate)
    if llm_schema_validity < LLM_SCHEMA_VALIDITY_THRESHOLD:
        block_reasons.append("llm_schema_validation_failed")

    mapping_rate = _mapping_rate(intents, workflows)
    outlier_rate = _metric(candidate, "outlierRate")
    raw_outlier_rate = _metric(candidate, "rawOutlierRate")
    workflow_separability = _metric(candidate, "workflowSeparability")
    slot_evidence_coverage = _metric(candidate, "slotEvidenceCoverage")
    policy_coverage = _metric(candidate, "policyCoverage")
    risk_coverage = _metric(candidate, "riskCoverage")
    semantic_quality_final = _bool_metric(candidate, "semanticQualityFinal")
    semantic_cluster_cohesion = _metric(candidate, "semanticClusterCohesion")
    semantic_separation_margin = _metric(candidate, "semanticSeparationMargin")
    cluster_distinctiveness = _metric(candidate, "clusterDistinctiveness")
    cluster_stability = _metric(candidate, "clusterStability")
    label_fidelity = _metric(candidate, "labelFidelity")
    label_member_evidence_coverage = _metric(candidate, "labelMemberEvidenceCoverage")
    label_object_coverage = _metric(candidate, "labelObjectCoverage")
    label_action_coverage = _metric(candidate, "labelActionCoverage")
    label_object_action_joint_coverage = _metric(candidate, "labelObjectActionJointCoverage")
    auto_candidate_label_count = _metric(candidate, "autoCandidateLabelCount")
    auto_candidate_label_fidelity = _metric(candidate, "autoCandidateLabelFidelity")
    auto_candidate_label_member_evidence_coverage = _metric(candidate, "autoCandidateLabelMemberEvidenceCoverage")
    auto_candidate_label_object_action_joint_coverage = _metric(
        candidate,
        "autoCandidateLabelObjectActionJointCoverage",
    )
    review_required_label_count = _metric(candidate, "reviewRequiredLabelCount")
    review_required_label_fidelity = _metric(candidate, "reviewRequiredLabelFidelity")
    review_required_label_member_evidence_coverage = _metric(candidate, "reviewRequiredLabelMemberEvidenceCoverage")
    review_required_label_object_action_joint_coverage = _metric(
        candidate,
        "reviewRequiredLabelObjectActionJointCoverage",
    )
    workflow_path_support = _metric(candidate, "workflowPathSupport")
    workflow_replay_fitness = _metric(candidate, "workflowReplayFitness")
    workflow_precision = _metric(candidate, "workflowPrecision")
    workflow_specificity = _metric(candidate, "workflowSpecificity")
    same_intent_overmerge_risk = _metric(candidate, "sameIntentOvermergeRisk")
    workflow_confidence_avg = _metric(candidate, "workflowConfidenceAvg")
    workflow_confidence_min = _metric(candidate, "workflowConfidenceMin")
    review_required_rate = _metric(candidate, "reviewRequiredRate")
    duplicate_label_rate = _metric(candidate, "duplicateLabelRate")
    parent_intent_count = _metric(candidate, "parentIntentCount")
    leaf_intent_count = _metric(candidate, "leafIntentCount")
    workflow_variant_intent_count = _metric(candidate, "workflowVariantIntentCount")
    variants_per_parent_intent_avg = _metric(candidate, "variantsPerParentIntentAvg")
    variants_per_parent_intent_max = _metric(candidate, "variantsPerParentIntentMax")
    single_variant_intent_rate = _metric(candidate, "singleVariantIntentRate")
    max_workflow_coverage = _metric(candidate, "maxWorkflowCoverage")
    effective_workflow_count = _metric(candidate, "effectiveWorkflowCount")
    entrypoint_semantic_coverage = _metric(candidate, "entrypointSemanticCoverage")
    entrypoint_distinctiveness = _metric(candidate, "entrypointDistinctiveness")
    route_condition_coverage = _metric(candidate, "routeConditionCoverage")
    policy_node_coverage = _metric(candidate, "policyNodeCoverage")
    risk_node_coverage = _metric(candidate, "riskNodeCoverage")
    for metric_name in REQUIRED_NUMERIC_METRICS:
        if _metric(candidate, metric_name) is None:
            block_reasons.append(f"missing_metric:{metric_name}")
    if semantic_quality_final is None:
        block_reasons.append("missing_metric:semanticQualityFinal")
    if mapping_rate < MAPPING_RATE_THRESHOLD:
        block_reasons.append("mapping_rate_below_threshold")
    if outlier_rate is not None and outlier_rate > OUTLIER_RATE_THRESHOLD:
        block_reasons.append("outlier_rate_above_threshold")
    if workflow_separability is not None and workflow_separability < WORKFLOW_SEPARABILITY_THRESHOLD:
        block_reasons.append("workflow_separability_below_threshold")
    if slot_evidence_coverage is not None and slot_evidence_coverage < SLOT_EVIDENCE_COVERAGE_THRESHOLD:
        block_reasons.append("slot_evidence_coverage_below_threshold")
    if policy_coverage is not None and policy_coverage < POLICY_COVERAGE_THRESHOLD:
        block_reasons.append("policy_coverage_below_threshold")
    if risk_coverage is not None and risk_coverage < RISK_COVERAGE_THRESHOLD:
        block_reasons.append("risk_coverage_below_threshold")
    if semantic_quality_final is False:
        block_reasons.append("semantic_quality_not_final")
    if cluster_stability is not None and cluster_stability < CLUSTER_STABILITY_THRESHOLD:
        quality_review_reasons.append("cluster_stability_below_threshold")
    if cluster_distinctiveness is not None and cluster_distinctiveness < CLUSTER_DISTINCTIVENESS_THRESHOLD:
        quality_review_reasons.append("cluster_distinctiveness_below_threshold")
    if label_fidelity is not None and label_fidelity < LABEL_FIDELITY_THRESHOLD:
        quality_review_reasons.append("label_fidelity_below_threshold")
    if workflow_path_support is not None and workflow_path_support < WORKFLOW_PATH_SUPPORT_THRESHOLD:
        block_reasons.append("workflow_path_support_below_threshold")
    _apply_tiered_label_gate(
        metric_value=label_member_evidence_coverage,
        auto_metric_value=auto_candidate_label_member_evidence_coverage,
        auto_count=auto_candidate_label_count,
        review_threshold=LABEL_MEMBER_EVIDENCE_COVERAGE_REVIEW_THRESHOLD,
        block_threshold=LABEL_MEMBER_EVIDENCE_COVERAGE_BLOCK_THRESHOLD,
        block_reason="label_member_evidence_coverage_below_block_threshold",
        review_reason="label_member_evidence_coverage_below_threshold",
        review_only_block_reason="review_required_label_member_evidence_coverage_below_block_threshold",
        auto_block_reason="auto_candidate_label_member_evidence_coverage_below_block_threshold",
        block_reasons=block_reasons,
        quality_review_reasons=quality_review_reasons,
    )
    _apply_tiered_label_gate(
        metric_value=label_object_action_joint_coverage,
        auto_metric_value=auto_candidate_label_object_action_joint_coverage,
        auto_count=auto_candidate_label_count,
        review_threshold=LABEL_OBJECT_ACTION_JOINT_COVERAGE_REVIEW_THRESHOLD,
        block_threshold=LABEL_OBJECT_ACTION_JOINT_COVERAGE_BLOCK_THRESHOLD,
        block_reason="label_object_action_joint_coverage_below_block_threshold",
        review_reason="label_object_action_joint_coverage_below_threshold",
        review_only_block_reason="review_required_label_object_action_joint_coverage_below_block_threshold",
        auto_block_reason="auto_candidate_label_object_action_joint_coverage_below_block_threshold",
        block_reasons=block_reasons,
        quality_review_reasons=quality_review_reasons,
    )
    if workflow_replay_fitness is not None and workflow_replay_fitness < WORKFLOW_REPLAY_FITNESS_BLOCK_THRESHOLD:
        block_reasons.append("workflow_replay_fitness_below_block_threshold")
    elif workflow_replay_fitness is not None and workflow_replay_fitness < WORKFLOW_REPLAY_FITNESS_REVIEW_THRESHOLD:
        quality_review_reasons.append("workflow_replay_fitness_below_threshold")
    if workflow_precision is not None and workflow_precision < WORKFLOW_PRECISION_BLOCK_THRESHOLD:
        block_reasons.append("workflow_precision_below_block_threshold")
    elif workflow_precision is not None and workflow_precision < WORKFLOW_PRECISION_REVIEW_THRESHOLD:
        quality_review_reasons.append("workflow_precision_below_threshold")
    if workflow_specificity is not None and workflow_specificity < WORKFLOW_SPECIFICITY_BLOCK_THRESHOLD:
        block_reasons.append("workflow_specificity_below_block_threshold")
    elif workflow_specificity is not None and workflow_specificity < WORKFLOW_SPECIFICITY_REVIEW_THRESHOLD:
        quality_review_reasons.append("workflow_specificity_below_threshold")
    if (
        same_intent_overmerge_risk is not None
        and same_intent_overmerge_risk > SAME_INTENT_OVERMERGE_RISK_BLOCK_THRESHOLD
    ):
        block_reasons.append("same_intent_overmerge_risk_above_block_threshold")
    elif (
        same_intent_overmerge_risk is not None
        and same_intent_overmerge_risk > SAME_INTENT_OVERMERGE_RISK_REVIEW_THRESHOLD
    ):
        quality_review_reasons.append("same_intent_overmerge_risk_above_threshold")
    if route_condition_coverage is not None and route_condition_coverage < ROUTE_CONDITION_COVERAGE_THRESHOLD:
        block_reasons.append("route_condition_coverage_below_threshold")
    if policy_node_coverage is not None and policy_node_coverage < POLICY_NODE_COVERAGE_THRESHOLD:
        block_reasons.append("policy_node_coverage_below_threshold")
    if risk_node_coverage is not None and risk_node_coverage < RISK_NODE_COVERAGE_THRESHOLD:
        block_reasons.append("risk_node_coverage_below_threshold")
    benchmark_suite = _coerce_benchmark_suite(benchmark)
    benchmark_summary = _benchmark_suite_summary(intents, workflows, benchmark_suite)
    pairwise_benchmark_summary = benchmark_summary["pairwise"]
    boundary_benchmark_summary = benchmark_summary["boundary"]
    label_benchmark_summary = benchmark_summary["label"]
    workflow_benchmark_summary = benchmark_summary["workflow"]
    if pairwise_benchmark_summary["enabled"] is True:
        if pairwise_benchmark_summary["cannotLinkViolationRate"] > BENCHMARK_CANNOT_LINK_VIOLATION_THRESHOLD:
            block_reasons.append("benchmark_cannot_link_violation")
        if pairwise_benchmark_summary["mustLinkRecall"] < BENCHMARK_MUST_LINK_RECALL_REVIEW_THRESHOLD:
            quality_review_reasons.append("benchmark_must_link_recall_below_threshold")
    if (
        boundary_benchmark_summary["enabled"] is True
        and boundary_benchmark_summary["boundaryRecall"] < BENCHMARK_BOUNDARY_RECALL_REVIEW_THRESHOLD
    ):
        quality_review_reasons.append("benchmark_boundary_recall_below_threshold")
    if label_benchmark_summary["enabled"] is True:
        if label_benchmark_summary["forbiddenTermViolationRate"] > 0.0:
            block_reasons.append("benchmark_label_forbidden_term_violation")
        if label_benchmark_summary["objectActionJointAccuracy"] < BENCHMARK_LABEL_JOINT_ACCURACY_REVIEW_THRESHOLD:
            quality_review_reasons.append("benchmark_label_object_action_joint_accuracy_below_threshold")
    if (
        workflow_benchmark_summary["enabled"] is True
        and workflow_benchmark_summary["eventRecall"] < BENCHMARK_WORKFLOW_EVENT_RECALL_REVIEW_THRESHOLD
    ):
        quality_review_reasons.append("benchmark_workflow_event_recall_below_threshold")
    passed = not block_reasons
    release_tier = _release_tier(
        block_reasons=block_reasons,
        cluster_stability=cluster_stability,
        label_fidelity=label_fidelity,
        workflow_path_support=workflow_path_support,
        quality_review_reasons=quality_review_reasons,
        review_required_rate=review_required_rate,
        duplicate_label_rate=duplicate_label_rate,
        workflow_confidence_avg=workflow_confidence_avg,
        workflow_confidence_min=workflow_confidence_min,
    )
    return {
        "passed": passed,
        "releaseTier": release_tier,
        "mappingRate": mapping_rate,
        "outlierRate": outlier_rate,
        "rawOutlierRate": raw_outlier_rate,
        "representedOutlierCoverage": _metric(candidate, "representedOutlierCoverage"),
        "promotedNovelCandidateCount": _metric(candidate, "promotedNovelCandidateCount"),
        "promotedNovelMemberCount": _metric(candidate, "promotedNovelMemberCount"),
        "unrepresentedOutlierMemberCount": _metric(candidate, "unrepresentedOutlierMemberCount"),
        "workflowSeparability": workflow_separability,
        "evidenceCoverage": evidence_coverage,
        "evidenceSufficiency": evidence_sufficiency["score"],
        "evidenceSufficiencySupportedFieldCount": evidence_sufficiency["supportedFieldCount"],
        "evidenceSufficiencyTotalFieldCount": evidence_sufficiency["totalFieldCount"],
        "evidenceSufficiencyUnsupportedFields": evidence_sufficiency["unsupportedFields"],
        "slotEvidenceCoverage": slot_evidence_coverage,
        "policyCoverage": policy_coverage,
        "riskCoverage": risk_coverage,
        "semanticQualityFinal": semantic_quality_final,
        "semanticClusterCohesion": semantic_cluster_cohesion,
        "semanticSeparationMargin": semantic_separation_margin,
        "clusterDistinctiveness": cluster_distinctiveness,
        "positiveMarginRate": _metric(candidate, "positiveMarginRate"),
        "semanticSilhouetteProxy": _metric(candidate, "semanticSilhouetteProxy"),
        "entrypointSemanticCoverage": entrypoint_semantic_coverage,
        "entrypointSemanticCohesion": _metric(candidate, "entrypointSemanticCohesion"),
        "entrypointSemanticSeparationMargin": _metric(candidate, "entrypointSemanticSeparationMargin"),
        "entrypointDistinctiveness": entrypoint_distinctiveness,
        "entrypointPositiveMarginRate": _metric(candidate, "entrypointPositiveMarginRate"),
        "clusterStability": cluster_stability,
        "labelFidelity": label_fidelity,
        "reviewCandidateLabelFidelity": _metric(candidate, "reviewCandidateLabelFidelity"),
        "labelMemberEvidenceCoverage": label_member_evidence_coverage,
        "labelObjectCoverage": label_object_coverage,
        "labelActionCoverage": label_action_coverage,
        "labelObjectActionJointCoverage": label_object_action_joint_coverage,
        "autoCandidateLabelCount": auto_candidate_label_count,
        "autoCandidateLabelFidelity": auto_candidate_label_fidelity,
        "autoCandidateLabelMemberEvidenceCoverage": auto_candidate_label_member_evidence_coverage,
        "autoCandidateLabelObjectActionJointCoverage": auto_candidate_label_object_action_joint_coverage,
        "reviewRequiredLabelCount": review_required_label_count,
        "reviewRequiredLabelFidelity": review_required_label_fidelity,
        "reviewRequiredLabelMemberEvidenceCoverage": review_required_label_member_evidence_coverage,
        "reviewRequiredLabelObjectActionJointCoverage": review_required_label_object_action_joint_coverage,
        "workflowPathSupport": workflow_path_support,
        "workflowReplayFitness": workflow_replay_fitness,
        "workflowPrecision": workflow_precision,
        "workflowSpecificity": workflow_specificity,
        "sameIntentOvermergeRisk": same_intent_overmerge_risk,
        "routeConditionCoverage": route_condition_coverage,
        "specificNodeRatio": _metric(candidate, "specificNodeRatio"),
        "workflowSpecificNodeRate": _metric(candidate, "workflowSpecificNodeRate"),
        "slotNodeCoverage": _metric(candidate, "slotNodeCoverage"),
        "policyNodeCoverage": policy_node_coverage,
        "riskNodeCoverage": risk_node_coverage,
        "lowSupportWorkflowRate": _metric(candidate, "lowSupportWorkflowRate"),
        "reviewOnlyWorkflowCount": _metric(candidate, "reviewOnlyWorkflowCount"),
        "workflowConfidenceAvg": workflow_confidence_avg,
        "workflowConfidenceMin": workflow_confidence_min,
        "highConfidenceWorkflowCount": _metric(candidate, "highConfidenceWorkflowCount"),
        "sampleReviewWorkflowCount": _metric(candidate, "sampleReviewWorkflowCount"),
        "reviewRequiredWorkflowCount": _metric(candidate, "reviewRequiredWorkflowCount"),
        "reviewRequiredRate": review_required_rate,
        "lowConfidenceWorkflowCount": _metric(candidate, "lowConfidenceWorkflowCount"),
        "duplicateLabelRate": duplicate_label_rate,
        "reviewCandidateDuplicateLabelRate": _metric(candidate, "reviewCandidateDuplicateLabelRate"),
        "parentIntentCount": parent_intent_count,
        "leafIntentCount": leaf_intent_count,
        "workflowVariantIntentCount": workflow_variant_intent_count,
        "variantsPerParentIntentAvg": variants_per_parent_intent_avg,
        "variantsPerParentIntentMax": variants_per_parent_intent_max,
        "singleVariantIntentRate": single_variant_intent_rate,
        "maxWorkflowCoverage": max_workflow_coverage,
        "effectiveWorkflowCount": effective_workflow_count,
        "avgSlotsPerIntent": _metric(candidate, "avgSlotsPerIntent"),
        "avgPoliciesPerIntent": _metric(candidate, "avgPoliciesPerIntent"),
        "avgRisksPerIntent": _metric(candidate, "avgRisksPerIntent"),
        "graphValidity": graph_validity,
        "graphValidationErrors": graph_validation_errors[:20],
        "llmSchemaValidity": llm_schema_validity,
        "llmRepairRate": _metric(candidate, "llmRepairRate"),
        "humanReviewRejectionRate": _metric(candidate, "humanReviewRejectionRate"),
        "benchmarkSuite": benchmark_summary,
        "pairwiseBenchmark": pairwise_benchmark_summary,
        "boundaryBenchmark": boundary_benchmark_summary,
        "labelBenchmark": label_benchmark_summary,
        "workflowBenchmark": workflow_benchmark_summary,
        "benchmarkPairCount": pairwise_benchmark_summary["pairCount"],
        "benchmarkCoverage": pairwise_benchmark_summary["coverage"],
        "benchmarkMustLinkRecall": pairwise_benchmark_summary["mustLinkRecall"],
        "benchmarkCannotLinkViolationRate": pairwise_benchmark_summary["cannotLinkViolationRate"],
        "benchmarkBoundaryCaseCount": boundary_benchmark_summary["caseCount"],
        "benchmarkBoundaryRecall": boundary_benchmark_summary["boundaryRecall"],
        "benchmarkLabelExpectationCount": label_benchmark_summary["expectationCount"],
        "benchmarkLabelObjectActionJointAccuracy": label_benchmark_summary["objectActionJointAccuracy"],
        "benchmarkWorkflowExpectationCount": workflow_benchmark_summary["expectationCount"],
        "benchmarkWorkflowEventRecall": workflow_benchmark_summary["eventRecall"],
        "blockReasons": block_reasons,
        "qualityReviewReasons": quality_review_reasons,
    }


def _apply_tiered_label_gate(
    *,
    metric_value: float | None,
    auto_metric_value: float | None,
    auto_count: float | None,
    review_threshold: float,
    block_threshold: float,
    block_reason: str,
    review_reason: str,
    review_only_block_reason: str,
    auto_block_reason: str,
    block_reasons: list[str],
    quality_review_reasons: list[str],
) -> None:
    if metric_value is None:
        return
    if _has_auto_label_subset(auto_count):
        if auto_metric_value is None:
            if metric_value < block_threshold:
                _append_unique(block_reasons, block_reason)
            elif metric_value < review_threshold:
                _append_unique(quality_review_reasons, review_reason)
            return
        if auto_metric_value < block_threshold:
            _append_unique(block_reasons, auto_block_reason)
            return
        if metric_value < block_threshold:
            _append_unique(quality_review_reasons, review_only_block_reason)
            return
    if metric_value < block_threshold:
        _append_unique(block_reasons, block_reason)
    elif metric_value < review_threshold:
        _append_unique(quality_review_reasons, review_reason)


def _has_auto_label_subset(auto_count: float | None) -> bool:
    return auto_count is not None and auto_count > 0.0


def _append_unique(items: list[str], value: str) -> None:
    if value not in items:
        items.append(value)


def _coerce_benchmark_suite(benchmark: dict[str, Any] | list[dict[str, object]] | None) -> dict[str, Any] | None:
    if benchmark is None:
        return None
    if isinstance(benchmark, list):
        return {
            **EMPTY_BENCHMARK_SUITE,
            "intentPairs": benchmark,
        }
    return _parse_benchmark_suite(benchmark)


def _benchmark_suite_summary(
    intents: list[dict[str, Any]],
    workflows: list[dict[str, Any]],
    benchmark: dict[str, Any] | None,
) -> dict[str, Any]:
    suite = benchmark or EMPTY_BENCHMARK_SUITE
    pairwise = _pairwise_benchmark_summary(intents, workflows, _suite_items(suite, "intentPairs"))
    boundary = _boundary_benchmark_summary(intents, workflows, _suite_items(suite, "boundaryCases"))
    label = _label_benchmark_summary(intents, workflows, _suite_items(suite, "labelExpectations"))
    workflow = _workflow_benchmark_summary(workflows, _suite_items(suite, "workflowExpectations"))
    enabled = any(item["enabled"] is True for item in (pairwise, boundary, label, workflow))
    return {
        "enabled": enabled,
        "schemaVersion": "evaluation-benchmark-suite.v1",
        "pairwise": pairwise,
        "boundary": boundary,
        "label": label,
        "workflow": workflow,
    }


def _suite_items(suite: dict[str, Any], key: str) -> list[dict[str, object]]:
    value = suite.get(key)
    if not isinstance(value, list):
        return []
    return [cast(dict[str, object], item) for item in value if isinstance(item, dict)]


def _pairwise_benchmark_summary(
    intents: list[dict[str, Any]],
    workflows: list[dict[str, Any]],
    benchmark: list[dict[str, object]] | None,
) -> dict[str, Any]:
    if not benchmark:
        return {
            "enabled": False,
            "schemaVersion": "pairwise-benchmark.v1",
            "pairCount": 0,
            "coverage": 1.0,
            "mustLinkCount": 0,
            "mustLinkCorrectCount": 0,
            "mustLinkViolationCount": 0,
            "mustLinkUnknownCount": 0,
            "mustLinkRecall": 1.0,
            "cannotLinkCount": 0,
            "cannotLinkViolationCount": 0,
            "cannotLinkUnknownCount": 0,
            "cannotLinkViolationRate": 0.0,
        }

    assignments = _caselet_intent_assignments(intents, workflows)
    unique_ids = {
        str(pair[key])
        for pair in benchmark
        for key in ("sourceId", "targetId")
        if isinstance(pair.get(key), str) and str(pair[key]).strip()
    }
    assigned_count = sum(1 for item_id in unique_ids if assignments.get(item_id))
    must_link_count = 0
    must_link_correct = 0
    must_link_violations = 0
    must_link_unknown = 0
    cannot_link_count = 0
    cannot_link_violations = 0
    cannot_link_unknown = 0

    for pair in benchmark:
        source_id = str(pair["sourceId"])
        target_id = str(pair["targetId"])
        relation = str(pair["relation"])
        source_assignments = assignments.get(source_id, set())
        target_assignments = assignments.get(target_id, set())
        unknown = not source_assignments or not target_assignments
        same_intent = bool(source_assignments & target_assignments)
        if relation == "must_link":
            must_link_count += 1
            if unknown:
                must_link_unknown += 1
            elif same_intent:
                must_link_correct += 1
            else:
                must_link_violations += 1
        elif relation == "cannot_link":
            cannot_link_count += 1
            if unknown:
                cannot_link_unknown += 1
            elif same_intent:
                cannot_link_violations += 1

    return {
        "enabled": True,
        "schemaVersion": "pairwise-benchmark.v1",
        "pairCount": len(benchmark),
        "coverage": assigned_count / len(unique_ids) if unique_ids else 1.0,
        "mustLinkCount": must_link_count,
        "mustLinkCorrectCount": must_link_correct,
        "mustLinkViolationCount": must_link_violations,
        "mustLinkUnknownCount": must_link_unknown,
        "mustLinkRecall": must_link_correct / must_link_count if must_link_count else 1.0,
        "cannotLinkCount": cannot_link_count,
        "cannotLinkViolationCount": cannot_link_violations,
        "cannotLinkUnknownCount": cannot_link_unknown,
        "cannotLinkViolationRate": cannot_link_violations / cannot_link_count if cannot_link_count else 0.0,
    }


def _boundary_benchmark_summary(
    intents: list[dict[str, Any]],
    workflows: list[dict[str, Any]],
    boundary_cases: list[dict[str, object]],
) -> dict[str, Any]:
    if not boundary_cases:
        return {
            "enabled": False,
            "schemaVersion": "boundary-benchmark.v1",
            "caseCount": 0,
            "expectedBoundaryCount": 0,
            "matchedBoundaryCount": 0,
            "unknownConversationCount": 0,
            "boundaryPrecision": 1.0,
            "boundaryRecall": 1.0,
        }
    details = _caselet_details(intents, workflows)
    by_conversation: dict[str, set[tuple[int, int]]] = {}
    for item in details.values():
        source_id = item.get("sourceConversationId")
        turn_start = item.get("turnStart")
        turn_end = item.get("turnEnd")
        if isinstance(source_id, str) and isinstance(turn_start, int) and isinstance(turn_end, int):
            by_conversation.setdefault(source_id, set()).add((turn_start, turn_end))
    expected_count = 0
    matched_count = 0
    observed_count = 0
    unknown_count = 0
    for boundary_case in boundary_cases:
        conversation_id = boundary_case.get("conversationId")
        if not isinstance(conversation_id, str):
            continue
        expected: set[tuple[int, int]] = set()
        for item in _object_list(boundary_case.get("expectedCaselets")):
            turn_start = item.get("turnStart")
            turn_end = item.get("turnEnd")
            if isinstance(turn_start, int) and isinstance(turn_end, int):
                expected.add((turn_start, turn_end))
        observed = by_conversation.get(conversation_id, set())
        expected_count += len(expected)
        observed_count += len(observed)
        matched_count += len(expected & observed)
        if not observed:
            unknown_count += 1
    return {
        "enabled": True,
        "schemaVersion": "boundary-benchmark.v1",
        "caseCount": len(boundary_cases),
        "expectedBoundaryCount": expected_count,
        "matchedBoundaryCount": matched_count,
        "unknownConversationCount": unknown_count,
        "boundaryPrecision": matched_count / observed_count if observed_count else 0.0,
        "boundaryRecall": matched_count / expected_count if expected_count else 1.0,
    }


def _label_benchmark_summary(
    intents: list[dict[str, Any]],
    workflows: list[dict[str, Any]],
    label_expectations: list[dict[str, object]],
) -> dict[str, Any]:
    if not label_expectations:
        return {
            "enabled": False,
            "schemaVersion": "label-benchmark.v1",
            "expectationCount": 0,
            "matchedExpectationCount": 0,
            "objectAccuracy": 1.0,
            "actionAccuracy": 1.0,
            "objectActionJointAccuracy": 1.0,
            "allowedLabelAccuracy": 1.0,
            "forbiddenTermViolationRate": 0.0,
            "unknownExpectationCount": 0,
        }
    assignments = _caselet_intent_assignments(intents, workflows)
    intent_by_code = {
        str(intent["intentCode"]): intent
        for intent in intents
        if isinstance(intent.get("intentCode"), str) and str(intent["intentCode"])
    }
    matched = 0
    object_correct = 0
    action_correct = 0
    joint_correct = 0
    allowed_total = 0
    allowed_correct = 0
    forbidden_total = 0
    forbidden_violations = 0
    unknown = 0
    for expectation in label_expectations:
        intent = _label_expectation_intent(expectation, intent_by_code, assignments)
        if intent is None:
            unknown += 1
            continue
        matched += 1
        name = str(intent.get("name") or "")
        expected_object = str(expectation.get("object") or "")
        expected_action = str(expectation.get("action") or "")
        object_ok = _text_supports_term(name, expected_object)
        action_ok = _text_supports_term(name, expected_action)
        object_correct += int(object_ok)
        action_correct += int(action_ok)
        joint_correct += int(object_ok and action_ok)
        allowed_labels = _str_list(expectation.get("allowedLabels"))
        if allowed_labels:
            allowed_total += 1
            allowed_correct += int(any(_normalize_text(name) == _normalize_text(label) for label in allowed_labels))
        forbidden_terms = _str_list(expectation.get("forbiddenTerms"))
        if forbidden_terms:
            forbidden_total += 1
            forbidden_violations += int(any(_text_supports_term(name, term) for term in forbidden_terms))
    denominator = matched if matched else 0
    return {
        "enabled": True,
        "schemaVersion": "label-benchmark.v1",
        "expectationCount": len(label_expectations),
        "matchedExpectationCount": matched,
        "objectAccuracy": object_correct / denominator if denominator else 0.0,
        "actionAccuracy": action_correct / denominator if denominator else 0.0,
        "objectActionJointAccuracy": joint_correct / denominator if denominator else 0.0,
        "allowedLabelAccuracy": allowed_correct / allowed_total if allowed_total else 1.0,
        "forbiddenTermViolationRate": forbidden_violations / forbidden_total if forbidden_total else 0.0,
        "unknownExpectationCount": unknown,
    }


def _workflow_benchmark_summary(
    workflows: list[dict[str, Any]],
    workflow_expectations: list[dict[str, object]],
) -> dict[str, Any]:
    if not workflow_expectations:
        return {
            "enabled": False,
            "schemaVersion": "workflow-benchmark.v1",
            "expectationCount": 0,
            "matchedExpectationCount": 0,
            "expectedEventCount": 0,
            "matchedEventCount": 0,
            "eventRecall": 1.0,
            "branchConditionRecall": 1.0,
            "unknownExpectationCount": 0,
        }
    workflows_by_caselet: dict[str, list[dict[str, Any]]] = {}
    for workflow in workflows:
        for workflow_caselet_id in _workflow_member_ids(workflow):
            workflows_by_caselet.setdefault(workflow_caselet_id, []).append(workflow)
    matched_expectations = 0
    unknown = 0
    expected_event_count = 0
    matched_event_count = 0
    expected_branch_count = 0
    matched_branch_count = 0
    for expectation in workflow_expectations:
        expected_caselet_id = expectation.get("caseletId")
        if not isinstance(expected_caselet_id, str):
            continue
        matched_workflows = workflows_by_caselet.get(expected_caselet_id, [])
        if not matched_workflows:
            unknown += 1
            expected_event_count += len(_str_list(expectation.get("expectedEvents")))
            expected_branch_count += len(_str_list(expectation.get("expectedBranchConditions")))
            continue
        matched_expectations += 1
        expected_events = _str_list(expectation.get("expectedEvents"))
        expected_event_count += len(expected_events)
        workflow_terms = set().union(*(_workflow_supported_terms(workflow) for workflow in matched_workflows))
        matched_event_count += sum(1 for event in expected_events if _term_supported_by_terms(event, workflow_terms))
        branch_conditions = _str_list(expectation.get("expectedBranchConditions"))
        expected_branch_count += len(branch_conditions)
        matched_branch_count += sum(
            1 for condition in branch_conditions if _term_supported_by_terms(condition, workflow_terms)
        )
    return {
        "enabled": True,
        "schemaVersion": "workflow-benchmark.v1",
        "expectationCount": len(workflow_expectations),
        "matchedExpectationCount": matched_expectations,
        "expectedEventCount": expected_event_count,
        "matchedEventCount": matched_event_count,
        "eventRecall": matched_event_count / expected_event_count if expected_event_count else 1.0,
        "branchConditionRecall": matched_branch_count / expected_branch_count if expected_branch_count else 1.0,
        "unknownExpectationCount": unknown,
    }


def _caselet_details(
    intents: list[dict[str, Any]],
    workflows: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    details: dict[str, dict[str, Any]] = {}
    for intent in intents:
        for item in _caselet_details_from_json_field(intent.get("sourceClusterRef")):
            _merge_caselet_detail(details, item)
        for item in _caselet_details_from_json_field(intent.get("evidenceJson")):
            _merge_caselet_detail(details, item)
        representative_cases = intent.get("representativeCases")
        if isinstance(representative_cases, list):
            for item in representative_cases:
                if isinstance(item, dict):
                    _merge_caselet_detail(details, cast(dict[str, Any], item))
    for workflow in workflows:
        for item in _caselet_details_from_json_field(workflow.get("evidenceJson")):
            _merge_caselet_detail(details, item)
        for item in _caselet_details_from_json_field(workflow.get("metaJson")):
            _merge_caselet_detail(details, item)
    return details


def _merge_caselet_detail(details: dict[str, dict[str, Any]], item: dict[str, Any]) -> None:
    caselet_id = _caselet_detail_id(item)
    if caselet_id is None:
        return
    current = details.setdefault(caselet_id, {"caseletId": caselet_id})
    for key in (
        "sourceConversationId",
        "conversationId",
        "turnStart",
        "turnEnd",
        "flowEvents",
        "actionObjectFrame",
        "evidenceTurnIds",
    ):
        if key in item and item[key] not in (None, "", [], {}):
            current[key] = item[key]


def _caselet_detail_id(item: dict[str, Any]) -> str | None:
    for key in ("caseletId", "conversationId", "id", "sourceCaseletId", "sourceConversationId"):
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    item_type = item.get("type")
    value = item.get("value")
    if item_type in {"member_conv_id", "exemplar_conv_id", "caselet_id"} and isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _caselet_details_from_json_field(value: object) -> list[dict[str, Any]]:
    if value is None:
        return []
    parsed: object = value
    if isinstance(value, str):
        if not value.strip():
            return []
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return [{"caseletId": value.strip()}]
    return _caselet_details_from_value(parsed)


def _caselet_details_from_value(value: object) -> list[dict[str, Any]]:
    if isinstance(value, dict):
        output: list[dict[str, Any]] = []
        if _caselet_detail_id(cast(dict[str, Any], value)) is not None:
            output.append(cast(dict[str, Any], value))
        for key in ("segments", "caselets", "representativeCases"):
            output.extend(_caselet_details_from_value(value.get(key)))
        return output
    if isinstance(value, list):
        list_output: list[dict[str, Any]] = []
        for item in value:
            list_output.extend(_caselet_details_from_value(item))
        return list_output
    return []


def _label_expectation_intent(
    expectation: dict[str, object],
    intent_by_code: dict[str, dict[str, Any]],
    assignments: dict[str, set[str]],
) -> dict[str, Any] | None:
    member_ids = _str_list(expectation.get("memberCaseletIds"))
    candidate_codes: set[str] = set()
    for member_id in member_ids:
        candidate_codes.update(assignments.get(member_id, set()))
    if candidate_codes:
        for code in sorted(candidate_codes):
            if code in intent_by_code:
                return intent_by_code[code]
    cluster_gold_id = expectation.get("clusterGoldId")
    if isinstance(cluster_gold_id, str):
        direct = intent_by_code.get(cluster_gold_id)
        if direct is not None:
            return direct
    return None


def _workflow_supported_terms(workflow: dict[str, Any]) -> set[str]:
    terms: set[str] = set()
    graph = _parse_graph(workflow.get("graphJson"))
    if graph is not None:
        nodes, edges = _graph_nodes_and_edges(graph)
        for item in (nodes or []) + (edges or []):
            if isinstance(item, dict):
                _collect_supported_terms(item, terms)
    for field in ("evidenceJson", "metaJson", "routeConditionJson"):
        _collect_supported_terms_from_json(workflow.get(field), terms)
    return {_normalize_text(term) for term in terms if _normalize_text(term)}


def _collect_supported_terms_from_json(value: object, output: set[str]) -> None:
    if value is None:
        return
    parsed: object = value
    if isinstance(value, str):
        if not value.strip():
            return
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            output.add(value)
            return
    _collect_supported_terms(parsed, output)


def _collect_supported_terms(value: object, output: set[str]) -> None:
    if isinstance(value, dict):
        for key, item in value.items():
            if key in {"label", "value", "action", "workflowVariant"} and isinstance(item, str):
                output.add(item)
            elif key in {"requiredTerms", "optionalTerms", "negativeTerms", "flowEvents", "expectedEvents"}:
                output.update(_str_list(item))
            elif key == "evidenceRefs" and isinstance(item, list):
                _collect_supported_terms(item, output)
            elif isinstance(item, (dict, list)):
                _collect_supported_terms(item, output)
    elif isinstance(value, list):
        for item in value:
            _collect_supported_terms(item, output)


def _term_supported_by_terms(term: str, supported_terms: set[str]) -> bool:
    normalized = _normalize_text(term)
    aliases = tuple(_normalize_text(alias) for alias in WORKFLOW_EVENT_TERM_ALIASES.get(term, ()))
    return any(
        normalized == candidate
        or normalized in candidate
        or candidate in normalized
        or any(alias and (alias == candidate or alias in candidate or candidate in alias) for alias in aliases)
        for candidate in supported_terms
    )


def _text_supports_term(text: str, term: str) -> bool:
    normalized_text = _normalize_text(text)
    normalized_term = _normalize_text(term)
    return bool(normalized_term) and normalized_term in normalized_text


def _normalize_text(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return "".join(value.casefold().split())


def _object_list(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        return []
    return [cast(dict[str, object], item) for item in value if isinstance(item, dict)]


def _str_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item.strip() for item in value if isinstance(item, str) and item.strip()]


def _caselet_intent_assignments(
    intents: list[dict[str, Any]],
    workflows: list[dict[str, Any]],
) -> dict[str, set[str]]:
    assignments: dict[str, set[str]] = {}
    for intent in intents:
        intent_code = intent.get("intentCode")
        if not isinstance(intent_code, str) or not intent_code:
            continue
        for item_id in _intent_member_ids(intent):
            assignments.setdefault(item_id, set()).add(intent_code)

    for workflow in workflows:
        intent_code = workflow.get("intentCode")
        if not isinstance(intent_code, str) or not intent_code:
            continue
        for item_id in _workflow_member_ids(workflow):
            assignments.setdefault(item_id, set()).add(intent_code)
    return assignments


def _intent_member_ids(intent: dict[str, Any]) -> set[str]:
    member_ids: set[str] = set()
    member_ids.update(_ids_from_json_field(intent.get("sourceClusterRef")))
    member_ids.update(_ids_from_json_field(intent.get("evidenceJson")))
    representative_cases = intent.get("representativeCases")
    if isinstance(representative_cases, list):
        for case in representative_cases:
            if isinstance(case, dict):
                member_ids.update(_ids_from_mapping(case))
    return member_ids


def _workflow_member_ids(workflow: dict[str, Any]) -> set[str]:
    member_ids: set[str] = set()
    member_ids.update(_ids_from_json_field(workflow.get("evidenceJson")))
    member_ids.update(_ids_from_json_field(workflow.get("metaJson")))
    return member_ids


def _ids_from_json_field(value: object) -> set[str]:
    if value is None:
        return set()
    parsed: object = value
    if isinstance(value, str):
        if not value.strip():
            return set()
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return {value.strip()}
    return _ids_from_value(parsed)


def _ids_from_value(value: object) -> set[str]:
    if isinstance(value, dict):
        return _ids_from_mapping(value)
    if isinstance(value, list):
        output: set[str] = set()
        for item in value:
            output.update(_ids_from_value(item))
        return output
    return set()


def _ids_from_mapping(value: dict[object, object]) -> set[str]:
    output: set[str] = set()
    id_keys = {
        "caseletId",
        "conversationId",
        "id",
        "sourceCaseletId",
        "sourceConversationId",
        "value",
    }
    id_list_keys = {
        "caseletIds",
        "conversationIds",
        "exemplarConversationIds",
        "memberConvIds",
        "memberConversationIds",
        "segmentIds",
    }
    item_type = value.get("type")
    for key, item in value.items():
        key_text = str(key)
        if key_text in id_keys and isinstance(item, str) and item.strip():
            if key_text != "value" or item_type in {"member_conv_id", "exemplar_conv_id", "caselet_id"}:
                output.add(item.strip())
        elif key_text in id_list_keys and isinstance(item, list):
            output.update(str(child).strip() for child in item if isinstance(child, str) and child.strip())
        elif isinstance(item, (dict, list)):
            output.update(_ids_from_value(item))
    return output


def _intent_items(candidate: dict[str, Any]) -> list[dict[str, Any]]:
    intent_draft = candidate.get("intentDraft")
    if not isinstance(intent_draft, dict):
        return []
    return _dict_items(intent_draft.get("intents"))


def _workflow_items(candidate: dict[str, Any]) -> list[dict[str, Any]]:
    workflow_draft = candidate.get("workflowDraft")
    if not isinstance(workflow_draft, dict):
        return []
    return _dict_items(workflow_draft.get("workflows"))


def _slot_items(candidate: dict[str, Any]) -> list[dict[str, Any]]:
    workflow_draft = candidate.get("workflowDraft")
    if not isinstance(workflow_draft, dict):
        return []
    return _dict_items(workflow_draft.get("slots"))


def _policy_items(candidate: dict[str, Any]) -> list[dict[str, Any]]:
    workflow_draft = candidate.get("workflowDraft")
    if not isinstance(workflow_draft, dict):
        return []
    return _dict_items(workflow_draft.get("policies"))


def _risk_items(candidate: dict[str, Any]) -> list[dict[str, Any]]:
    workflow_draft = candidate.get("workflowDraft")
    if not isinstance(workflow_draft, dict):
        return []
    return _dict_items(workflow_draft.get("risks"))


def _dict_items(value: object) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [cast(dict[str, Any], item) for item in value if isinstance(item, dict)]


def _mapping_rate(intents: list[dict[str, Any]], workflows: list[dict[str, Any]]) -> float:
    if not intents or not workflows:
        return 0.0
    intent_codes = {item.get("intentCode") for item in intents if isinstance(item.get("intentCode"), str)}
    if not intent_codes:
        return 0.0
    mapped_workflows = sum(1 for workflow in workflows if workflow.get("intentCode") in intent_codes)
    return mapped_workflows / len(workflows)


def _release_tier(
    *,
    block_reasons: list[str],
    cluster_stability: float | None,
    label_fidelity: float | None,
    workflow_path_support: float | None,
    quality_review_reasons: list[str],
    review_required_rate: float | None,
    duplicate_label_rate: float | None,
    workflow_confidence_avg: float | None,
    workflow_confidence_min: float | None,
) -> str:
    if block_reasons:
        return "REJECTED"
    if quality_review_reasons:
        return "REVIEW_REQUIRED"
    auto_ready = (
        _value_at_least(cluster_stability, 0.75)
        and _value_at_least(label_fidelity, 0.75)
        and _value_at_least(workflow_path_support, 0.75)
        and _value_at_most(review_required_rate, AUTO_REVIEW_REQUIRED_RATE_THRESHOLD)
        and _value_at_most(duplicate_label_rate, AUTO_DUPLICATE_LABEL_RATE_THRESHOLD)
        and _value_at_least(workflow_confidence_avg, AUTO_WORKFLOW_CONFIDENCE_AVG_THRESHOLD)
        and _value_at_least(workflow_confidence_min, AUTO_WORKFLOW_CONFIDENCE_MIN_THRESHOLD)
    )
    return "AUTO_CANDIDATE" if auto_ready else "REVIEW_REQUIRED"


def _value_at_least(value: float | None, threshold: float) -> bool:
    return value is not None and value >= threshold


def _value_at_most(value: float | None, threshold: float) -> bool:
    return value is not None and value <= threshold


def _graph_validity(workflows: list[dict[str, Any]]) -> str:
    return "passed" if not _graph_validation_errors(workflows) else "failed"


def _graph_validation_errors(workflows: list[dict[str, Any]]) -> list[str]:
    errors: list[str] = []
    for workflow in workflows:
        graph = _parse_graph(workflow.get("graphJson"))
        if graph is None:
            errors.append("graph_json_invalid")
            continue
        nodes, edges = _graph_nodes_and_edges(graph)
        if nodes is None or edges is None:
            errors.append("graph_shape_invalid")
            continue
        node_errors = _node_validation_errors(nodes)
        edge_errors = _edge_validation_errors(nodes, edges)
        reachability_errors = _reachability_validation_errors(nodes, edges)
        errors.extend(node_errors + edge_errors + reachability_errors)
    return errors


def _node_validation_errors(nodes: list[object]) -> list[str]:
    node_dicts = [node for node in nodes if isinstance(node, dict)]
    node_ids = [node.get("id") for node in node_dicts]
    errors: list[str] = []
    if len(node_ids) != len(set(node_ids)):
        errors.append("duplicate_node_id")
    if not any(node.get("type") == "START" for node in node_dicts):
        errors.append("missing_start_node")
    if not _has_terminal_node(nodes):
        errors.append("missing_terminal_node")
    allowed_types = {"START", "ACTION", "DECISION", "HANDOFF", "TERMINAL"}
    if any(node.get("type") not in allowed_types for node in node_dicts):
        errors.append("unknown_node_type")
    if len(node_dicts) != len(nodes):
        errors.append("malformed_node")
    return errors


def _edge_validation_errors(nodes: list[object], edges: list[object]) -> list[str]:
    errors: list[str] = []
    if not _edges_reference_existing_nodes(nodes, edges):
        errors.append("edge_endpoint_missing")
    if any(not isinstance(edge, dict) or not isinstance(edge.get("id"), str) for edge in edges):
        errors.append("malformed_edge")
    edge_ids = [edge.get("id") for edge in edges if isinstance(edge, dict)]
    if len(edge_ids) != len(set(edge_ids)):
        errors.append("duplicate_edge_id")
    return errors


def _reachability_validation_errors(nodes: list[object], edges: list[object]) -> list[str]:
    node_dicts = [node for node in nodes if isinstance(node, dict) and isinstance(node.get("id"), str)]
    node_by_id = {str(node["id"]): node for node in node_dicts}
    starts = [node_id for node_id, node in node_by_id.items() if node.get("type") == "START"]
    terminals = {node_id for node_id, node in node_by_id.items() if node.get("type") == "TERMINAL"}
    adjacency: dict[str, list[str]] = {node_id: [] for node_id in node_by_id}
    incoming: dict[str, int] = {node_id: 0 for node_id in node_by_id}
    for edge in edges:
        if not isinstance(edge, dict) or not isinstance(edge.get("from"), str) or not isinstance(edge.get("to"), str):
            continue
        source = str(edge["from"])
        target = str(edge["to"])
        if source in adjacency and target in incoming:
            adjacency[source].append(target)
            incoming[target] += 1
    reachable = _reachable_nodes(starts, adjacency)
    errors: list[str] = []
    if terminals and not (reachable & terminals):
        errors.append("terminal_unreachable")
    if any(node_id not in reachable for node_id in node_by_id):
        errors.append("unreachable_node")
    dead_non_terminal = [
        node_id
        for node_id, node in node_by_id.items()
        if node.get("type") != "TERMINAL" and node_id in reachable and not adjacency.get(node_id)
    ]
    if dead_non_terminal:
        errors.append("dead_non_terminal_node")
    orphan_non_start = [
        node_id
        for node_id, node in node_by_id.items()
        if node.get("type") != "START" and node_id in reachable and incoming.get(node_id, 0) == 0
    ]
    if orphan_non_start:
        errors.append("orphan_node")
    return errors


def _reachable_nodes(starts: list[str], adjacency: dict[str, list[str]]) -> set[str]:
    seen: set[str] = set()
    stack = list(starts)
    while stack:
        node_id = stack.pop()
        if node_id in seen:
            continue
        seen.add(node_id)
        stack.extend(target for target in adjacency.get(node_id, []) if target not in seen)
    return seen


def _parse_graph(graph_raw: object) -> dict[str, Any] | None:
    if not isinstance(graph_raw, str):
        return None
    try:
        graph = json.loads(graph_raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(graph, dict):
        return None
    return cast(dict[str, Any], graph)


def _graph_nodes_and_edges(graph: dict[str, Any]) -> tuple[list[object] | None, list[object] | None]:
    nodes = graph.get("nodes")
    edges = graph.get("edges")
    if not isinstance(nodes, list) or not isinstance(edges, list):
        return None, None
    return nodes, edges


def _has_terminal_node(nodes: list[object]) -> bool:
    return any(isinstance(node, dict) and node.get("type") == "TERMINAL" for node in nodes)


def _edges_reference_existing_nodes(nodes: list[object], edges: list[object]) -> bool:
    node_ids = {node.get("id") for node in nodes if isinstance(node, dict)}
    return all(isinstance(edge, dict) and edge.get("from") in node_ids and edge.get("to") in node_ids for edge in edges)


def _evidence_coverage(items: list[dict[str, Any]]) -> float:
    grounded_items = [item for item in items if not _needs_review(item)]
    if not grounded_items:
        return 1.0
    supported = sum(1 for item in grounded_items if _has_evidence(item))
    return supported / len(grounded_items)


def _evidence_sufficiency_summary(
    intents: list[dict[str, Any]],
    workflows: list[dict[str, Any]],
    slots: list[dict[str, Any]],
    policies: list[dict[str, Any]],
    risks: list[dict[str, Any]],
) -> dict[str, Any]:
    specs: tuple[tuple[str, list[dict[str, Any]], tuple[str, ...]], ...] = (
        ("intent", intents, ("name", "description", "entryConditionJson")),
        ("workflow", workflows, ("name", "description", "graphJson", "routeConditionJson")),
        ("slot", slots, ("name", "description", "validationRuleJson")),
        ("policy", policies, ("name", "description", "conditionJson", "actionJson")),
        ("risk", risks, ("name", "description", "conditionJson", "mitigationJson")),
    )
    total = 0
    supported = 0
    unsupported_fields: list[dict[str, str]] = []
    for entity_type, items, fields in specs:
        for item in items:
            evidence_ref_count = _evidence_ref_count(item)
            for field in fields:
                if not _field_has_content(item, field):
                    continue
                total += 1
                if _field_has_sufficient_evidence(item, field, evidence_ref_count):
                    supported += 1
                    continue
                if len(unsupported_fields) < EVIDENCE_SUFFICIENCY_UNSUPPORTED_FIELD_LIMIT:
                    unsupported_fields.append(
                        {
                            "entityType": entity_type,
                            "entityCode": _entity_code(item),
                            "field": field,
                        }
                    )
    score = supported / total if total > 0 else 1.0
    return {
        "score": score,
        "supportedFieldCount": supported,
        "totalFieldCount": total,
        "unsupportedFieldCount": total - supported,
        "unsupportedFields": unsupported_fields,
    }


def _field_has_sufficient_evidence(item: dict[str, Any], field: str, evidence_ref_count: int) -> bool:
    enrichment_key = f"{field}EnrichmentJson"
    if enrichment_key in item:
        return _enrichment_has_used_evidence(item.get(enrichment_key))
    return evidence_ref_count > 0


def _enrichment_has_used_evidence(value: object) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return False
    if not isinstance(parsed, dict):
        return False
    used_ids = parsed.get("usedEvidenceIds")
    return isinstance(used_ids, list) and any(isinstance(item, str) and item for item in used_ids)


def _field_has_content(item: dict[str, Any], field: str) -> bool:
    value = item.get(field)
    if isinstance(value, str):
        text = value.strip()
        if not text or text in {"{}", "[]", "null"}:
            return False
        if field.endswith("Json"):
            try:
                return _evidence_has_content(json.loads(text))
            except json.JSONDecodeError:
                return False
        return True
    return _evidence_has_content(value)


def _evidence_ref_count(item: dict[str, Any]) -> int:
    evidence = item.get("evidenceJson") or item.get("evidenceRefs")
    return _count_evidence_refs(evidence)


def _count_evidence_refs(value: object) -> int:
    if isinstance(value, str):
        if not value.strip():
            return 0
        try:
            return _count_evidence_refs(json.loads(value))
        except json.JSONDecodeError:
            return 1
    if isinstance(value, list):
        return sum(_count_evidence_refs(item) for item in value)
    if isinstance(value, dict):
        list_values = [item for item in value.values() if isinstance(item, list) and item]
        if list_values:
            return sum(_count_evidence_refs(item) for item in list_values)
        return 1 if _evidence_has_content(value) else 0
    return 1 if _evidence_has_content(value) else 0


def _entity_code(item: dict[str, Any]) -> str:
    for key in ("intentCode", "workflowCode", "slotCode", "policyCode", "riskCode"):
        value = item.get(key)
        if isinstance(value, str) and value:
            return value
    return "unknown"


def _has_evidence(item: dict[str, Any]) -> bool:
    evidence = item.get("evidenceJson") or item.get("evidenceRefs")
    if isinstance(evidence, list):
        return _evidence_has_content(evidence)
    if not isinstance(evidence, str) or not evidence.strip():
        return False
    try:
        parsed = json.loads(evidence)
    except json.JSONDecodeError:
        return False
    return _evidence_has_content(parsed)


def _evidence_has_content(value: object) -> bool:
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return True
    if isinstance(value, list):
        return any(_evidence_has_content(item) for item in value)
    if isinstance(value, dict):
        return any(_evidence_has_content(item) for item in value.values())
    return False


def _needs_review(item: dict[str, Any]) -> bool:
    status = str(item.get("reviewStatus") or item.get("status") or "").lower()
    return status == "needs_review"


def _pii_redaction_failed(candidate: dict[str, Any]) -> bool:
    summary = candidate.get("preprocessingSummary")
    return isinstance(summary, dict) and summary.get("piiRedactionFailed") is True


def _has_auto_confirmed_unsupported_policy_or_risk(items: list[dict[str, Any]]) -> bool:
    for item in items:
        if _has_evidence(item):
            continue
        status = str(item.get("reviewStatus") or item.get("status") or "").lower()
        if status in {"approved", "auto_confirmed", "confirmed"}:
            return True
    return False


def _llm_schema_validity(candidate: dict[str, Any]) -> float:
    summary = candidate.get("llmSummary")
    if not isinstance(summary, dict):
        return 1.0
    valid = summary.get("schemaValidCount")
    total = summary.get("schemaTotalCount")
    if isinstance(valid, int) and isinstance(total, int) and total > 0:
        return valid / total
    failed = summary.get("schemaFailureCount")
    if isinstance(failed, int) and failed > 0:
        return 0.0
    return 1.0


def _metric(candidate: dict[str, Any], key: str) -> float | None:
    value = _metric_value(candidate.get("evaluationInputs"), key)
    if value is None:
        value = _metric_value(candidate.get("evaluationSummary"), key)
    if value is None:
        return None
    return value


def _bool_metric(candidate: dict[str, Any], key: str) -> bool | None:
    value = _bool_metric_value(candidate.get("evaluationInputs"), key)
    if value is None:
        value = _bool_metric_value(candidate.get("evaluationSummary"), key)
    return value


def _bool_metric_value(payload: object, key: str) -> bool | None:
    if not isinstance(payload, dict):
        return None
    value = payload.get(key)
    return value if isinstance(value, bool) else None


def _metric_value(payload: object, key: str) -> float | None:
    if not isinstance(payload, dict):
        return None
    value = payload.get(key)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    return None
