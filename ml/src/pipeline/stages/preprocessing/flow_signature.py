"""
flow_signature 모듈 — 상담 flow를 61차원 벡터로 인코딩.

이벤트 규칙은 5stone
(ajou-2026-1-capstone-5-5stone/src/common/preprocessor.py:65-121)의
_EVENT_RULES를 참고하여 동일 키워드를 사용한다.
"""

from __future__ import annotations

from collections.abc import Sequence

import numpy as np

# pyright: reportMissingImports=false, reportUnknownArgumentType=false, reportUnknownMemberType=false, reportUnknownParameterType=false, reportUnknownVariableType=false
from .types import (
    FLOW_SIGNATURE_DIM,
    SPEAKER_ROLE_AGENT,
    SPEAKER_ROLE_CUSTOMER,
    SPEAKER_ROLE_SYSTEM,
    Conversation,
)

EVENT_LABELS: tuple[str, ...] = (
    "이관",
    "해결",
    "불만표현",
    "추가정보요청",
    "정책안내",
    "확인질문",
    "예외처리",
)
_EVENT_INDEX: dict[str, int] = {label: index for index, label in enumerate(EVENT_LABELS)}
_OUTCOME_LABELS: tuple[str, ...] = ("resolved", "escalated", "unknown")
_OUTCOME_INDEX: dict[str, int] = {label: index for index, label in enumerate(_OUTCOME_LABELS)}

_EVENT_KEYWORDS: dict[str, tuple[str, ...]] = {
    "이관": ("이관", "연결", "담당 부서", "담당자", "전달", "넘겨", "접수 후"),
    "해결": ("처리", "해결", "완료", "이용 가능", "정지 해제", "도와드렸", "접수되었", "변경되었"),
    "불만표현": ("불편", "불만", "왜", "안 되", "오류", "문제", "이상", "짜증", "화나", "환불"),
    "추가정보요청": ("말씀 부탁", "알려주", "확인 가능", "번호", "성함", "생년월일", "정보", "입력", "보내드리면"),
    "정책안내": ("가능합니다", "불가", "규정", "정책", "약관", "수수료", "요금", "추가로 발생", "포함", "조건"),
    "확인질문": ("맞하신가요", "맞나요", "혹시", "되실까요", "인가요", "확인해", "확인 부탁"),
    "예외처리": ("특별", "예외", "우회", "다르게", "변경 가능", "조치", "해드리겠습니다"),
}

_CUSTOMER_ROLE_ALIASES = frozenset({"customer", "cust", "user", "client", "고객"})
_AGENT_ROLE_ALIASES = frozenset({"agent", "advisor", "operator", "상담사", "상담원"})
_SYSTEM_ROLE_ALIASES = frozenset({"system", "bot", "assistant", "시스템"})

assert FLOW_SIGNATURE_DIM == 61


def normalize_speaker_role(speaker_role: str) -> str:
    """발화자 역할을 customer/agent/system 중 하나로 정규화한다."""

    normalized = speaker_role.strip().lower()
    if normalized in _CUSTOMER_ROLE_ALIASES:
        return SPEAKER_ROLE_CUSTOMER
    if normalized in _AGENT_ROLE_ALIASES:
        return SPEAKER_ROLE_AGENT
    if normalized in _SYSTEM_ROLE_ALIASES:
        return SPEAKER_ROLE_SYSTEM
    return SPEAKER_ROLE_SYSTEM


def infer_event(turn_text: str, speaker_role: str) -> str:
    """정적 키워드 규칙으로 이벤트 라벨을 추론한다."""

    _ = speaker_role
    normalized_text = turn_text.strip()
    for label, keywords in _EVENT_KEYWORDS.items():
        if any(keyword in normalized_text for keyword in keywords):
            return label
    return "확인질문"


def compute_event_histogram(events: Sequence[str]) -> np.ndarray:
    """이벤트 시퀀스를 7차원 정규화 히스토그램으로 변환한다."""

    histogram = np.zeros(len(EVENT_LABELS), dtype=np.float32)
    for event in events:
        histogram[_EVENT_INDEX[event]] += 1.0

    total = float(histogram.sum())
    if total > 0.0:
        histogram /= total
    return histogram


def compute_transition_matrix(events: Sequence[str]) -> np.ndarray:
    """이벤트 전이를 7x7 행 정규화 행렬로 변환한다."""

    matrix = np.zeros((len(EVENT_LABELS), len(EVENT_LABELS)), dtype=np.float32)
    for current_event, next_event in zip(events, events[1:]):
        matrix[_EVENT_INDEX[current_event], _EVENT_INDEX[next_event]] += 1.0

    row_sums = matrix.sum(axis=1)
    for row_index, row_sum in enumerate(row_sums):
        if row_sum > 0.0:
            matrix[row_index] /= row_sum
    return matrix


def detect_escalation_flag(events: Sequence[str]) -> float:
    """이관 이벤트 존재 여부를 0/1 플래그로 반환한다."""

    return 1.0 if "이관" in events else 0.0


def detect_exception_flag(events: Sequence[str]) -> float:
    """예외처리 이벤트 존재 여부를 0/1 플래그로 반환한다."""

    return 1.0 if "예외처리" in events else 0.0


def infer_outcome(conv: Conversation) -> str:
    """Conversation 종료 상태를 outcome 라벨로 정규화한다."""

    if conv.ended_status == "resolved":
        return "resolved"
    if conv.ended_status == "escalated":
        return "escalated"
    return "unknown"


def outcome_to_one_hot(outcome: str) -> np.ndarray:
    """outcome 라벨을 3차원 one-hot 벡터로 변환한다."""

    one_hot = np.zeros(len(_OUTCOME_LABELS), dtype=np.float32)
    one_hot[_OUTCOME_INDEX[outcome]] = 1.0
    return one_hot


def build_signature(conv: Conversation) -> np.ndarray:
    """Conversation을 61차원 flow signature 벡터로 인코딩한다."""

    normalized_roles = tuple(normalize_speaker_role(turn.speaker_role) for turn in conv.turns)
    events = [infer_event(turn.text, normalized_role) for turn, normalized_role in zip(conv.turns, normalized_roles)]

    histogram = compute_event_histogram(events)
    transition = compute_transition_matrix(events)
    escalation = detect_escalation_flag(events)
    exception = detect_exception_flag(events)
    outcome = outcome_to_one_hot("unknown") if not conv.turns else outcome_to_one_hot(infer_outcome(conv))

    signature = np.concatenate(
        [
            histogram,
            transition.flatten(),
            np.array([escalation, exception], dtype=np.float32),
            outcome,
        ]
    ).astype(np.float32)
    if signature.shape != (FLOW_SIGNATURE_DIM,):
        raise RuntimeError(
            f"Flow signature shape mismatch: expected ({FLOW_SIGNATURE_DIM},), got {signature.shape}"
        )
    return signature
