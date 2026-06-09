from __future__ import annotations

from pipeline.stages.intent_discovery.domain_profile import (
    CONFIRMED_DOMAIN_METHOD,
    GENERIC_ROOT_DOMAIN,
    UNKNOWN_ROOT_DOMAIN,
    infer_root_domain_profile,
    load_confirmed_domain_profile,
    load_confirmed_domain_profile_from_env,
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


def test_should_load_confirmed_domain_profile(tmp_path) -> None:
    profile_path = tmp_path / "confirmed.json"
    profile_path.write_text(
        """
        {
          "candidateId": "card",
          "displayName": "카드 상담",
          "confidence": 0.87,
          "domainLexicon": ["분실", "한도"],
          "evidenceTerms": ["카드", "결제"],
          "evidenceConversationIds": ["c1"],
          "sourceReviewTaskId": 10
        }
        """,
        encoding="utf-8",
    )

    profile = load_confirmed_domain_profile(profile_path)

    assert profile.method == CONFIRMED_DOMAIN_METHOD
    assert profile.root_domain == "카드 상담"
    assert profile.allowed_rule_domains == ("카드 상담",)
    assert profile.domain_lexicon == ("분실", "한도")
    assert profile.to_dict()["confirmedDomain"] == "카드 상담"
    assert profile.to_dict()["usesOperatorCategoryMetadata"] is True


def test_should_preserve_operator_edited_description_and_exclusion_terms(tmp_path) -> None:
    profile_path = tmp_path / "confirmed.json"
    profile_path.write_text(
        """
        {
          "candidateId": "card",
          "displayName": "신용카드 분실/도난",
          "description": "분실·도난 신고와 재발급 중심 상담",
          "confidence": 0.9,
          "domainLexicon": ["재발급", "도난신고"],
          "evidenceTerms": ["분실", "도난"],
          "exclusionTerms": ["배송"],
          "sourceReviewTaskId": 11
        }
        """,
        encoding="utf-8",
    )

    profile = load_confirmed_domain_profile(profile_path)
    serialized = profile.to_dict()

    assert profile.domain_lexicon == ("재발급", "도난신고")
    assert profile.evidence_terms["신용카드 분실/도난"] == ("분실", "도난")
    assert serialized["domainEvidence"]["description"] == "분실·도난 신고와 재발급 중심 상담"
    assert serialized["domainEvidence"]["exclusionTerms"] == ["배송"]
    assert serialized["method"] == CONFIRMED_DOMAIN_METHOD
    assert serialized["usesOperatorCategoryMetadata"] is True


def test_load_confirmed_domain_profile_from_env_returns_none_without_path(monkeypatch) -> None:
    monkeypatch.delenv("PIPELINE_CONFIRMED_DOMAIN_PROFILE_PATH", raising=False)

    assert load_confirmed_domain_profile_from_env() is None


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
