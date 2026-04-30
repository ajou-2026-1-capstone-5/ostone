"""전처리 stage용 텍스트 정규화 유틸리티.

참고: 5stone (ajou-2026-1-capstone-5-5stone/src/common/preprocessor.py)의
규칙 기반 canonicalization 흐름과 정규식 패턴을 현재 프로젝트 타입에 맞게 재구성했다.
직접 import 하지 않고 알고리즘만 참고한다.
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from dataclasses import replace

from .types import (
    SPEAKER_ROLE_AGENT,
    SPEAKER_ROLE_CUSTOMER,
    SPEAKER_ROLE_SYSTEM,
    Conversation,
    ConversationTurn,
)

_PII_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\d{6}[-.]?\d{7}"), "[MASKED]"),
    (re.compile(r"\d{3}[-.]\d{4}[-.]\d{4}"), "[MASKED]"),
    (re.compile(r"\d{2,3}[-.]\d{3,4}[-.]\d{4}"), "[MASKED]"),
]

_GREETING_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"안녕하세요"),
    re.compile(r"안녕하십니까"),
    re.compile(r"좋은 하루"),
    re.compile(r"감사합니다"),
    re.compile(r"고맙습니다"),
    re.compile(r"수고하세요"),
    re.compile(r"행복한 하루"),
    re.compile(r"즐거운 하루"),
)

_SCRIPT_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"말씀 부탁"),
    re.compile(r"확인 가능"),
    re.compile(r"인증 번호"),
    re.compile(r"본인 확인"),
    re.compile(r"전화 번호"),
    re.compile(r"성함"),
    re.compile(r"생년월일"),
    re.compile(r"정보 입력"),
)

_STOPWORDS: frozenset[str] = frozenset(
    {
        "고객님",
        "저희",
        "혹시",
        "입니다",
        "합니다",
        "주세요",
        "드리겠습니다",
        "부탁드립니다",
        "네",
        "아니요",
    }
)

_PURPOSE_KEYWORDS: tuple[str, ...] = (
    "해결",
    "문제",
    "요청",
    "변경",
    "취소",
    "환불",
    "신청",
    "문의",
    "확인",
    "조회",
)

_CUSTOMER_ROLE_ALIASES: frozenset[str] = frozenset({"고객", "손님", "CUSTOMER", SPEAKER_ROLE_CUSTOMER})
_AGENT_ROLE_ALIASES: frozenset[str] = frozenset({"상담사", "상담원", "에이전트", "AGENT", SPEAKER_ROLE_AGENT})
_WHITESPACE_PATTERN = re.compile(r"\s+")
_SENTENCE_SPLIT_PATTERN = re.compile(r"(?<=[.!?。])\s+|\n+")


def normalize_speaker_role(role: str) -> str:
    normalized_role = role.strip()
    if normalized_role in _CUSTOMER_ROLE_ALIASES:
        return SPEAKER_ROLE_CUSTOMER
    if normalized_role in _AGENT_ROLE_ALIASES:
        return SPEAKER_ROLE_AGENT
    return SPEAKER_ROLE_SYSTEM


def mask_pii(text: str) -> tuple[str, int]:
    masked_text = text
    mask_count = 0

    for pattern, replacement in _PII_PATTERNS:
        masked_text, current_count = pattern.subn(replacement, masked_text)
        mask_count += current_count

    return masked_text, mask_count


def remove_greetings(text: str) -> str:
    return _filter_sentences(text, _GREETING_PATTERNS)


def remove_scripts(text: str) -> str:
    return _filter_sentences(text, _SCRIPT_PATTERNS)


def remove_stopwords(text: str) -> str:
    words = _clean_text(text).split()
    filtered_words = [word for word in words if word not in _STOPWORDS]
    return " ".join(filtered_words)


def extract_purpose_sentences(text: str) -> str:
    sentences = _split_sentences(text)
    purpose_sentences = [
        sentence for sentence in sentences if any(keyword in sentence for keyword in _PURPOSE_KEYWORDS)
    ]

    if not purpose_sentences:
        return _clean_text(text)

    return _clean_text(" ".join(purpose_sentences))


def apply_strong_canonicalization(text: str) -> tuple[str, int]:
    masked_text, mask_count = mask_pii(text)
    text_without_greetings = remove_greetings(masked_text)
    text_without_scripts = remove_scripts(text_without_greetings)
    text_without_stopwords = remove_stopwords(text_without_scripts)
    canonical_text = extract_purpose_sentences(text_without_stopwords)
    return _clean_text(canonical_text), mask_count


def extract_customer_text(turns: Sequence[ConversationTurn]) -> str:
    customer_text = " ".join(
        turn.text for turn in turns if normalize_speaker_role(turn.speaker_role) == SPEAKER_ROLE_CUSTOMER
    )
    return _clean_text(customer_text)


def apply_canonicalization(conv: Conversation) -> tuple[str, str, int]:
    normalized_turns = tuple(
        replace(turn, speaker_role=normalize_speaker_role(turn.speaker_role)) for turn in conv.turns
    )

    whole_text = _clean_text(" ".join(turn.text for turn in normalized_turns))
    customer_text = extract_customer_text(normalized_turns)
    canonical_text, mask_count = apply_strong_canonicalization(whole_text)

    if not customer_text:
        agent_text = _extract_agent_text(normalized_turns)
        if agent_text:
            canonical_text, _ = apply_strong_canonicalization(agent_text)
        customer_problem_text = ""
    else:
        customer_problem_text, _ = apply_strong_canonicalization(customer_text)

    return canonical_text, customer_problem_text, mask_count


def _clean_text(text: str) -> str:
    return _WHITESPACE_PATTERN.sub(" ", text).strip()


def _split_sentences(text: str) -> list[str]:
    cleaned_text = _clean_text(text)
    if not cleaned_text:
        return []

    return [sentence.strip() for sentence in _SENTENCE_SPLIT_PATTERN.split(cleaned_text) if sentence.strip()]


def _filter_sentences(text: str, patterns: Sequence[re.Pattern[str]]) -> str:
    sentences = _split_sentences(text)
    filtered_sentences = [
        sentence for sentence in sentences if not any(pattern.search(sentence) for pattern in patterns)
    ]
    return _clean_text(" ".join(filtered_sentences))


def _extract_agent_text(turns: Sequence[ConversationTurn]) -> str:
    agent_text = " ".join(
        turn.text for turn in turns if normalize_speaker_role(turn.speaker_role) == SPEAKER_ROLE_AGENT
    )
    return _clean_text(agent_text)
