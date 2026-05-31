from __future__ import annotations

from pipeline.stages.intent_discovery.domain_profile import (
    GENERIC_ROOT_DOMAIN,
    UNKNOWN_ROOT_DOMAIN,
    infer_root_domain_profile,
)
from pipeline.stages.preprocessing.types import FLOW_SIGNATURE_DIM, ProcessedConversation


def test_should_build_generic_keyword_profile_without_domain_specific_labels() -> None:
    conversations = [_processed_conversation(index, "납부 금액 변경 요청 확인 필요") for index in range(20)]

    profile = infer_root_domain_profile(conversations)

    assert profile.root_domain == GENERIC_ROOT_DOMAIN
    assert profile.confidence > 0.0
    assert profile.allowed_rule_domains == (GENERIC_ROOT_DOMAIN,)
    assert "generic" in profile.evidence_terms
    assert profile.to_dict()["usesOperatorCategoryMetadata"] is False
    assert profile.to_dict()["usesDomainSpecificLexicon"] is False


def test_should_mark_empty_profile_as_unknown() -> None:
    conversations = [_processed_conversation(0, "문의 확인 감사합니다")]

    profile = infer_root_domain_profile(conversations)

    assert profile.root_domain == UNKNOWN_ROOT_DOMAIN
    assert profile.allowed_rule_domains == ()


def _processed_conversation(index: int, text: str) -> ProcessedConversation:
    return ProcessedConversation(
        id=f"c{index}",
        dataset_id="ds1",
        channel="chat",
        ended_status="unknown",
        metadata={},
        canonical_text=text,
        customer_problem_text=text,
        flow_signature=tuple([0.0] * FLOW_SIGNATURE_DIM),
        flow_signature_dim=FLOW_SIGNATURE_DIM,
        turn_count=2,
        customer_turn_count=1,
        pii_mask_count=0,
        filtered=False,
    )
