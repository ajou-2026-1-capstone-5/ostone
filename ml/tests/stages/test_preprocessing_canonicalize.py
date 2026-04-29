from __future__ import annotations

# pyright: reportMissingTypeStubs=false
import pytest

from pipeline.stages.preprocessing.canonicalize import (
    apply_canonicalization,
    apply_strong_canonicalization,
    mask_pii,
    normalize_speaker_role,
    remove_greetings,
    remove_scripts,
)
from pipeline.stages.preprocessing.types import Conversation, ConversationTurn


@pytest.mark.parametrize(
    ("role", "expected"),
    [
        ("AGENT", "agent"),
        ("상담사", "agent"),
        ("customer", "customer"),
        ("고객", "customer"),
        ("bot", "system"),
    ],
)
def test_should_normalize_speaker_role(role: str, expected: str) -> None:
    """normalize_speaker_role가 역할 별칭을 일관되게 정규화하는지 확인한다."""

    assert normalize_speaker_role(role) == expected


@pytest.mark.parametrize(
    ("text", "expected_count"),
    [
        ("내 번호 010-1234-5678 입니다", 1),
        ("주민번호 123456-1234567 확인", 1),
        ("PII 없는 텍스트", 0),
    ],
)
def test_should_mask_pii_patterns(text: str, expected_count: int) -> None:
    """mask_pii가 PII 패턴을 마스킹하고 개수를 반환하는지 확인한다."""

    masked_text, count = mask_pii(text)

    assert count == expected_count
    if expected_count == 0:
        assert masked_text == text
    else:
        assert "[MASKED]" in masked_text


def test_should_remove_greetings_and_scripts() -> None:
    """인사말과 스크립트 문구가 제거되는지 확인한다."""

    greeting_removed = remove_greetings("안녕하세요 문제 있어요")
    script_removed = remove_scripts("말씀 부탁 드립니다 번호는요?")

    assert "안녕하세요" not in greeting_removed
    assert "말씀 부탁" not in script_removed


def test_should_apply_strong_canonicalization() -> None:
    """강한 canonicalization이 불필요 표현을 제거하는지 확인한다."""

    text, count = apply_strong_canonicalization("안녕하세요 고객님 전화번호 확인 부탁 문제 해결 요청")

    assert "고객님" not in text
    assert count >= 0


def test_should_apply_canonicalization_without_customer_turns() -> None:
    """고객 발화가 없으면 customer_problem_text가 비어 있는지 확인한다."""

    conversation = Conversation(
        conversation_id="c1",
        dataset_id="ds1",
        turns=(ConversationTurn(turn_id="t1", speaker_role="agent", text="안녕하세요 상담원입니다"),),
    )

    canonical_text, customer_text, pii_count = apply_canonicalization(conversation)

    assert isinstance(canonical_text, str)
    assert customer_text == ""
    assert pii_count >= 0


def test_should_apply_canonicalization_with_customer_turns() -> None:
    """고객 발화가 있으면 customer_problem_text가 생성되는지 확인한다."""

    conversation = Conversation(
        conversation_id="c1",
        dataset_id="ds1",
        turns=(
            ConversationTurn(turn_id="t1", speaker_role="agent", text="안녕하세요 상담원입니다"),
            ConversationTurn(turn_id="t2", speaker_role="customer", text="문제 해결 요청합니다"),
        ),
    )

    canonical_text, customer_text, pii_count = apply_canonicalization(conversation)

    assert isinstance(canonical_text, str)
    assert customer_text != ""
    assert pii_count >= 0
