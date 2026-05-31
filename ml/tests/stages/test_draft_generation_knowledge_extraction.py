from __future__ import annotations

import json
from typing import Any

from pipeline.stages.draft_generation.knowledge_extraction import (
    build_evidence_based_slot_draft,
    build_policy_risk_draft,
)


def test_slot_extraction_uses_generic_evidence_without_fixed_customer_slots() -> None:
    clusters = [
        {
            "cluster_id": 7,
            "workflow_signal": {"requires_payment_check": True, "requires_user_identification": True},
            "exemplar_conv_ids": ["c1"],
            "member_conv_ids": ["c1", "c2"],
            "keywords": ["금액", "변경", "확인"],
        }
    ]
    preprocessed = {
        "c1": _conv("c1", "본인 인증 후 결제 금액과 납부 수단 변경을 확인하고 싶어요"),
        "c2": _conv("c2", "접수번호와 금액, 계좌 이체 가능 여부를 문의합니다"),
    }

    slots, bindings, metrics = build_evidence_based_slot_draft(clusters, preprocessed)

    names = {slot["name"] for slot in slots}
    assert "본인 인증 정보" in names
    assert "금액/수량" in names
    assert "결제/납부 수단" in names
    assert "고객 이름" not in names
    assert "고객 연락처" not in names
    assert all(json.loads(slot["evidenceJson"]) for slot in slots)
    assert all(binding["intentCode"] == "INTENT_7" for binding in bindings)
    assert metrics["slot_evidence_coverage"] == 1.0


def test_policy_and_risk_extraction_creates_evidence_grounded_generic_candidates() -> None:
    clusters = [
        {
            "cluster_id": 3,
            "workflow_signal": {"requires_payment_check": True},
            "exemplar_conv_ids": ["c1"],
            "member_conv_ids": ["c1", "c2"],
            "keywords": ["취소", "환불", "수수료"],
        }
    ]
    preprocessed = {
        "c1": _conv("c1", "취소 시 환불 수수료와 규정을 확인하고 싶어요"),
        "c2": _conv("c2", "변경과 환불 가능 여부를 문의합니다"),
    }

    policies, risks, policy_refs, metrics = build_policy_risk_draft(clusters, preprocessed)

    assert policies
    assert risks
    assert policy_refs[3] == policies[0]["policyCode"]
    assert any(policy["name"] == "변경/취소 기준 확인" for policy in policies)
    assert any(risk["name"] == "금전 손실/오청구 위험" for risk in risks)
    assert all(json.loads(policy["evidenceJson"]) for policy in policies)
    assert all(json.loads(risk["evidenceJson"]) for risk in risks)
    policy_evidence = json.loads(policies[0]["evidenceJson"])
    policy_condition = json.loads(policies[0]["conditionJson"])
    policy_meta = json.loads(policies[0]["metaJson"])
    risk_condition = json.loads(risks[0]["conditionJson"])
    risk_meta = json.loads(risks[0]["metaJson"])
    assert any(item["type"] == "evidence_span" and item["value"] for item in policy_evidence)
    assert policy_condition["claimType"] in {"POLICY_RULE", "PROCEDURE"}
    assert policy_condition["supportCount"] > 0
    assert policy_condition["contradictionCount"] == 0
    assert policy_meta["claimExtractionMethod"] == "evidence_claim_pattern.v1"
    assert risk_condition["claimType"] == "RISK_TRIGGER"
    assert risk_meta["supportCount"] > 0
    assert policy_meta["supportSnippetCount"] > 0
    assert policy_meta["supportRatio"] > 0
    assert policy_meta["distinctMatchedTermCount"] > 0
    assert policy_meta["supportLevel"] in {"moderate", "strong"}
    assert metrics["policy_coverage"] == 1.0
    assert metrics["risk_coverage"] == 1.0


def test_policy_extraction_prefers_agent_evidence_over_customer_claims() -> None:
    clusters = [
        {
            "cluster_id": 6,
            "workflow_signal": {},
            "exemplar_conv_ids": ["c1"],
            "member_conv_ids": ["c1", "c2"],
            "keywords": ["환불", "수수료"],
        }
    ]
    preprocessed = {
        "c1": _conv(
            "c1",
            "환불 수수료 규정이 궁금합니다",
            agent_resolution_text="접수 내용 확인 후 결과를 안내드렸습니다",
        ),
        "c2": _conv(
            "c2",
            "취소 규정과 환불 수수료를 알고 싶어요",
            agent_resolution_text="요청 내용을 확인했습니다",
        ),
    }

    policies, risks, _policy_refs, _metrics = build_policy_risk_draft(clusters, preprocessed)

    policy_names = {policy["name"] for policy in policies}
    assert "변경/취소 기준 확인" not in policy_names
    assert any(policy["name"] in {"요청 조건 확인", "처리 기준 검토"} for policy in policies)
    policy_evidence = [item for policy in policies for item in json.loads(policy["evidenceJson"])]
    policy_spans = [item["value"] for item in policy_evidence if item.get("type") == "evidence_span"]
    assert policy_spans
    assert all("환불 수수료" not in span for span in policy_spans)
    assert any(risk["name"] == "금전 손실/오청구 위험" for risk in risks)


def test_policy_extraction_uses_agent_policy_claim_when_available() -> None:
    clusters = [
        {
            "cluster_id": 8,
            "workflow_signal": {},
            "exemplar_conv_ids": ["c1"],
            "member_conv_ids": ["c1", "c2"],
            "keywords": ["환불", "수수료"],
        }
    ]
    preprocessed = {
        "c1": _conv(
            "c1",
            "환불이 가능한가요",
            agent_resolution_text="취소 수수료 규정 확인 후 환불 가능 여부를 안내드립니다",
        ),
        "c2": _conv(
            "c2",
            "변경하고 싶어요",
            agent_resolution_text="변경과 취소는 규정 확인 후 처리 가능합니다",
        ),
    }

    policies, _risks, _policy_refs, _metrics = build_policy_risk_draft(clusters, preprocessed)

    change_policy = next(policy for policy in policies if policy["name"] == "변경/취소 기준 확인")
    evidence = json.loads(change_policy["evidenceJson"])
    spans = [item for item in evidence if item.get("type") == "evidence_span"]
    assert spans
    assert all("규정" in span["value"] for span in spans)
    assert all(span["sourceScope"] == "agent" for span in spans)


def test_broad_policy_templates_require_multiple_distinct_terms() -> None:
    clusters = [
        {
            "cluster_id": 4,
            "workflow_signal": {},
            "exemplar_conv_ids": ["c1"],
            "member_conv_ids": ["c1", "c2", "c3"],
            "keywords": ["확인"],
        }
    ]
    preprocessed = {
        "c1": _conv("c1", "확인"),
        "c2": _conv("c2", "확인"),
        "c3": _conv("c3", "확인"),
    }

    policies, _risks, _policy_refs, _metrics = build_policy_risk_draft(clusters, preprocessed)

    assert policies[0]["name"] == "처리 기준 검토"


def test_policy_and_risk_extraction_falls_back_to_review_candidates_when_specific_signal_is_missing() -> None:
    clusters = [
        {
            "cluster_id": 9,
            "root_domain": "mixed_or_unknown",
            "workflow_signal": {},
            "exemplar_conv_ids": ["c1"],
            "member_conv_ids": ["c1"],
            "keywords": ["기타", "문의"],
        }
    ]
    preprocessed = {"c1": _conv("c1", "안녕하세요 감사합니다")}

    policies, risks, policy_refs, _metrics = build_policy_risk_draft(clusters, preprocessed)

    assert policies[0]["name"] == "처리 기준 검토"
    assert risks[0]["name"] == "처리 오류/오안내 위험"
    assert policy_refs[9] == policies[0]["policyCode"]
    assert json.loads(policies[0]["conditionJson"])["claimType"] == "OBSERVED_ACTION"
    assert json.loads(policies[0]["evidenceJson"])
    assert json.loads(risks[0]["evidenceJson"])


def test_slot_extraction_merges_duplicate_definitions_and_keeps_ranked_bindings() -> None:
    clusters = [
        {
            "cluster_id": 1,
            "workflow_signal": {"requires_payment_check": True},
            "exemplar_conv_ids": ["c1"],
            "member_conv_ids": ["c1"],
        },
        {
            "cluster_id": 2,
            "workflow_signal": {"requires_payment_check": True},
            "exemplar_conv_ids": ["c2"],
            "member_conv_ids": ["c2"],
        },
    ]
    preprocessed = {
        "c1": _conv("c1", "결제 금액과 납부일, 접수번호를 확인하고 싶어요"),
        "c2": _conv("c2", "청구 금액과 납부 수단 변경 가능 여부를 문의합니다"),
    }

    slots, bindings, metrics = build_evidence_based_slot_draft(clusters, preprocessed)

    slot_codes = [slot["slotCode"] for slot in slots]
    assert len(slot_codes) == len(set(slot_codes))
    assert len(bindings) > len(slots)
    assert metrics["slot_deduplication_rate"] > 0.0
    amount_slot = next(slot for slot in slots if slot["name"] == "금액/수량")
    meta = json.loads(amount_slot["metaJson"])
    assert meta["deduplicatedFromCount"] == 2
    assert meta["appliesToIntentCodes"] == ["INTENT_1", "INTENT_2"]
    assert all("reviewGroupKey" in json.loads(binding["conditionJson"]) for binding in bindings)


def test_policy_and_risk_extraction_merges_duplicate_review_groups() -> None:
    clusters = [
        {
            "cluster_id": 1,
            "workflow_signal": {"requires_payment_check": True},
            "exemplar_conv_ids": ["c1"],
            "member_conv_ids": ["c1"],
        },
        {
            "cluster_id": 2,
            "workflow_signal": {"requires_payment_check": True},
            "exemplar_conv_ids": ["c2"],
            "member_conv_ids": ["c2"],
        },
    ]
    preprocessed = {
        "c1": _conv("c1", "취소 시 환불 수수료와 규정을 확인하고 싶어요"),
        "c2": _conv("c2", "변경과 환불 가능 여부, 취소 수수료를 문의합니다"),
    }

    policies, risks, policy_refs, metrics = build_policy_risk_draft(clusters, preprocessed)

    assert metrics["policy_deduplication_rate"] > 0.0
    assert metrics["risk_deduplication_rate"] > 0.0
    assert len({policy["policyCode"] for policy in policies}) == len(policies)
    assert policy_refs[1] == policy_refs[2]
    change_policy = next(policy for policy in policies if policy["name"] == "변경/취소 기준 확인")
    policy_meta = json.loads(change_policy["metaJson"])
    assert policy_meta["appliesToIntentCodes"] == ["INTENT_1", "INTENT_2"]
    assert 0.0 <= policy_meta["supportRatio"] <= 1.0
    financial_risk = next(risk for risk in risks if risk["name"] == "금전 손실/오청구 위험")
    risk_meta = json.loads(financial_risk["metaJson"])
    assert risk_meta["deduplicatedFromCount"] == 2
    assert 0.0 <= risk_meta["supportRatio"] <= 1.0


def _conv(conv_id: str, text: str, *, agent_resolution_text: str = "", agent_action_text: str = "") -> dict[str, Any]:
    return {
        "id": conv_id,
        "canonical_text": text,
        "customer_problem_text": text,
        "agent_resolution_text": agent_resolution_text,
        "agent_action_text": agent_action_text,
        "ended_status": "resolved",
    }
