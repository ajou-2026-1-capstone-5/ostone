from __future__ import annotations

from typing import Any

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
CLUSTER_STABILITY_THRESHOLD = 0.50
CLUSTER_DISTINCTIVENESS_THRESHOLD = 0.20
LABEL_FIDELITY_THRESHOLD = 0.55
WORKFLOW_PATH_SUPPORT_THRESHOLD = 0.60
LABEL_MEMBER_EVIDENCE_COVERAGE_REVIEW_THRESHOLD = 0.70
LABEL_MEMBER_EVIDENCE_COVERAGE_BLOCK_THRESHOLD = 0.40
LABEL_OBJECT_ACTION_JOINT_COVERAGE_REVIEW_THRESHOLD = 0.45
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
AUTO_REVIEW_REQUIRED_RATE_THRESHOLD = 0.30
AUTO_DUPLICATE_LABEL_RATE_THRESHOLD = 0.10
AUTO_WORKFLOW_CONFIDENCE_AVG_THRESHOLD = 0.70
AUTO_WORKFLOW_CONFIDENCE_MIN_THRESHOLD = 0.50
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
