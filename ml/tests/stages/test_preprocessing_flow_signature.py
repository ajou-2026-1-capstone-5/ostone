from __future__ import annotations

# pyright: reportMissingTypeStubs=false, reportAny=false
import numpy as np

from pipeline.stages.preprocessing.flow_signature import (
    EVENT_LABELS,
    build_signature,
    compute_event_histogram,
    compute_transition_matrix,
    detect_escalation_flag,
    detect_exception_flag,
    infer_event,
    infer_outcome,
    outcome_to_one_hot,
)
from pipeline.stages.preprocessing.types import FLOW_SIGNATURE_DIM, Conversation, ConversationTurn


def test_should_expose_event_labels_and_dimension() -> None:
    """flow signature 공개 상수가 기대 차원과 라벨 수를 유지하는지 확인한다."""

    assert len(EVENT_LABELS) == 7
    assert FLOW_SIGNATURE_DIM == 61


def test_should_infer_events_with_default_fallback() -> None:
    """이벤트 추론이 키워드와 기본값을 올바르게 선택하는지 확인한다."""

    assert infer_event("불편해서 환불 요청", "customer") == "불만표현"
    assert infer_event("처리 완료", "agent") in ("해결", "확인질문")
    assert infer_event("아무 키워드 없음", "agent") == "확인질문"


def test_should_compute_normalized_event_histogram() -> None:
    """이벤트 히스토그램이 정규화되고 빈 입력도 처리하는지 확인한다."""

    histogram = compute_event_histogram(["이관", "이관", "해결"])
    empty_histogram = compute_event_histogram([])

    assert np.isclose(float(histogram.sum()), 1.0, atol=1e-6)
    assert histogram[0] > 0
    assert histogram[1] > 0
    assert empty_histogram.shape == (7,)
    assert float(empty_histogram.sum()) == 0.0


def test_should_compute_transition_matrix_and_flags() -> None:
    """전이 행렬과 escalation/exception 플래그를 계산하는지 확인한다."""

    transition = compute_transition_matrix(["이관", "해결"])

    assert transition.shape == (7, 7)
    assert detect_escalation_flag(["이관", "해결"]) == 1.0
    assert detect_exception_flag(["이관", "해결"]) == 0.0
    assert detect_exception_flag(["예외처리"]) == 1.0


def test_should_infer_outcome_and_convert_to_one_hot() -> None:
    """종료 상태를 outcome 라벨과 one-hot 벡터로 변환하는지 확인한다."""

    resolved = Conversation(conversation_id="c", dataset_id="ds", ended_status="resolved", turns=())
    escalated = Conversation(conversation_id="c", dataset_id="ds", ended_status="escalated", turns=())

    assert infer_outcome(resolved) == "resolved"
    assert infer_outcome(escalated) == "escalated"
    assert outcome_to_one_hot("resolved").tolist() == [1.0, 0.0, 0.0]


def test_should_build_signature_for_empty_conversation() -> None:
    """빈 conversation도 unknown outcome 기반 61차원 벡터로 인코딩하는지 확인한다."""

    signature = build_signature(Conversation(conversation_id="c", dataset_id="ds", turns=()))

    assert signature.shape == (61,)
    assert signature.dtype == np.float32
    assert signature[58] == 0.0
    assert signature[59] == 0.0
    assert signature[60] == 1.0


def test_should_build_signature_for_real_conversation() -> None:
    """실제 상담 흐름을 flow signature로 인코딩하는지 확인한다."""

    conversation = Conversation(
        conversation_id="c1",
        dataset_id="ds1",
        ended_status="resolved",
        turns=(
            ConversationTurn(turn_id="t1", speaker_role="agent", text="안녕하세요 상담원입니다"),
            ConversationTurn(turn_id="t2", speaker_role="customer", text="주문 환불 요청합니다 불편해요"),
            ConversationTurn(turn_id="t3", speaker_role="agent", text="처리 완료"),
        ),
    )

    signature = build_signature(conversation)

    assert signature.shape == (61,)
    assert signature.dtype == np.float32


def test_should_build_signature_with_system_turns() -> None:
    """system 역할이 포함돼도 flow signature를 생성하는지 확인한다."""

    conversation = Conversation(
        conversation_id="c1",
        dataset_id="ds1",
        turns=(
            ConversationTurn(turn_id="t1", speaker_role="system", text="봇 안내 메세지"),
            ConversationTurn(turn_id="t2", speaker_role="customer", text="주문 환불 요청"),
        ),
    )

    signature = build_signature(conversation)

    assert signature.shape == (61,)
