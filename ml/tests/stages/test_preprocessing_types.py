from __future__ import annotations

# pyright: reportMissingTypeStubs=false
from dataclasses import FrozenInstanceError

import pytest

from pipeline.stages.preprocessing.types import (
    FLOW_SIGNATURE_DIM,
    SPEAKER_ROLE_CUSTOMER,
    Conversation,
    ConversationTurn,
    ProcessedConversation,
)


def test_should_create_conversation_turn_and_processed_conversation() -> None:
    """전처리 타입 객체가 기대한 필드를 보존하는지 확인한다."""

    turn = ConversationTurn(turn_id="t1", speaker_role="agent", text="hello")
    conv = Conversation(conversation_id="c1", dataset_id="ds1", turns=(turn,))
    processed = ProcessedConversation(
        id="c1",
        dataset_id="ds1",
        canonical_text="test",
        customer_problem_text="problem",
        flow_signature=tuple([0.0] * FLOW_SIGNATURE_DIM),
        flow_signature_dim=FLOW_SIGNATURE_DIM,
        turn_count=1,
        customer_turn_count=0,
        pii_mask_count=0,
        filtered=False,
    )

    assert turn.text == "hello"
    assert isinstance(conv.turns, tuple)
    assert processed.flow_signature_dim == FLOW_SIGNATURE_DIM


def test_should_keep_preprocessing_conversation_frozen() -> None:
    """Conversation dataclass가 불변 객체인지 확인한다."""

    turn = ConversationTurn(turn_id="t1", speaker_role="agent", text="hello")
    conversation = Conversation(conversation_id="c1", dataset_id="ds1", turns=(turn,))

    with pytest.raises(FrozenInstanceError):
        setattr(conversation, "dataset_id", "changed")


def test_should_expose_preprocessing_constants() -> None:
    """전처리 stage 상수가 공개 계약과 일치하는지 확인한다."""

    assert SPEAKER_ROLE_CUSTOMER == "customer"
    assert FLOW_SIGNATURE_DIM == 61
