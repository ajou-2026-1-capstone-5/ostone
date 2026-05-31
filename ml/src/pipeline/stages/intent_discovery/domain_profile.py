from __future__ import annotations

import json
import os
import re
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pipeline.common.exceptions import PipelineStageError
from pipeline.stages.preprocessing.types import ProcessedConversation

UNKNOWN_ROOT_DOMAIN = "mixed_or_unknown"
GENERIC_ROOT_DOMAIN = "generic"
_MIN_PROFILE_TERM_LENGTH = 2
_PROFILE_STOPWORDS = frozenset(
    {
        "고객",
        "고객님",
        "상담",
        "상담사",
        "문의",
        "확인",
        "합니다",
        "있습니다",
        "없습니다",
        "안녕하세요",
        "감사합니다",
        "그리고",
        "그럼",
        "혹시",
        "지금",
        "오늘",
        "저는",
        "제가",
        "해주세요",
        "부탁드립니다",
        "가능한가요",
        "어떻게",
    }
)


@dataclass(frozen=True)
class RootDomainProfile:
    root_domain: str
    confidence: float
    sample_size: int
    total_conversation_count: int
    scores: dict[str, float]
    evidence_terms: dict[str, tuple[str, ...]]
    method: str = "unsupervised_keyword_profile.v1"
    domain_lexicon: tuple[str, ...] = ()
    domain_evidence: dict[str, object] | None = None

    @property
    def allowed_rule_domains(self) -> tuple[str, ...]:
        if self.root_domain == UNKNOWN_ROOT_DOMAIN:
            return ()
        if self.method == "llm_confirmed_domain.v1":
            return (self.root_domain,)
        return (GENERIC_ROOT_DOMAIN,)

    def to_dict(self) -> dict[str, object]:
        return {
            "rootDomain": self.root_domain,
            "confidence": self.confidence,
            "sampleSize": self.sample_size,
            "totalConversationCount": self.total_conversation_count,
            "scores": self.scores,
            "evidenceTerms": {domain: list(terms) for domain, terms in self.evidence_terms.items()},
            "allowedRuleDomains": list(self.allowed_rule_domains),
            "method": self.method,
            "confirmedDomain": self.root_domain if self.method == "llm_confirmed_domain.v1" else None,
            "domainLexicon": list(self.domain_lexicon),
            "domainEvidence": self.domain_evidence or {},
            "usesOperatorCategoryMetadata": self.method == "llm_confirmed_domain.v1",
            "usesDomainSpecificLexicon": bool(self.domain_lexicon),
        }


def load_confirmed_domain_profile_from_env() -> RootDomainProfile | None:
    path_value = os.getenv("PIPELINE_CONFIRMED_DOMAIN_PROFILE_PATH", "").strip()
    if not path_value:
        return None
    return load_confirmed_domain_profile(Path(path_value))


def load_confirmed_domain_profile(path: Path) -> RootDomainProfile:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PipelineStageError(f"Failed to read confirmed domain profile: {path}") from exc
    if not isinstance(payload, dict):
        raise PipelineStageError("Confirmed domain profile must be a JSON object.")
    root_domain = _confirmed_domain(payload)
    lexicon = tuple(_string_list(payload.get("domainLexicon") or payload.get("suggestedDomainLexicon")))
    evidence_terms = tuple(_string_list(payload.get("evidenceTerms") or payload.get("domainLexicon")))[:24]
    confidence = _bounded_float(payload.get("confidence") or payload.get("domainConfidence"), default=0.0)
    return RootDomainProfile(
        root_domain=root_domain,
        confidence=confidence,
        sample_size=_int_value(payload.get("sampleSize")),
        total_conversation_count=_int_value(payload.get("totalConversationCount")),
        scores={root_domain: confidence},
        evidence_terms={root_domain: evidence_terms},
        method="llm_confirmed_domain.v1",
        domain_lexicon=lexicon,
        domain_evidence={
            "candidateId": payload.get("candidateId"),
            "displayName": payload.get("displayName"),
            "evidenceConversationIds": _string_list(payload.get("evidenceConversationIds")),
            "sourceReviewTaskId": payload.get("sourceReviewTaskId"),
        },
    )


def infer_root_domain_profile(
    conversations: Sequence[ProcessedConversation],
    sample_size: int = 80,
) -> RootDomainProfile:
    sampled = _deterministic_sample(conversations, sample_size)
    terms = _profile_terms(sampled)
    if not terms:
        return RootDomainProfile(
            root_domain=UNKNOWN_ROOT_DOMAIN,
            confidence=0.0,
            sample_size=len(sampled),
            total_conversation_count=len(conversations),
            scores={},
            evidence_terms={},
        )

    total = sum(terms.values())
    top_terms = tuple(term for term, _count in terms.most_common(12))
    top_count = terms[top_terms[0]] if top_terms else 0
    confidence = round(top_count / total, 6) if total > 0 else 0.0
    return RootDomainProfile(
        root_domain=GENERIC_ROOT_DOMAIN,
        confidence=confidence,
        sample_size=len(sampled),
        total_conversation_count=len(conversations),
        scores={GENERIC_ROOT_DOMAIN: float(total)},
        evidence_terms={GENERIC_ROOT_DOMAIN: top_terms},
    )


def _deterministic_sample(
    conversations: Sequence[ProcessedConversation],
    sample_size: int,
) -> list[ProcessedConversation]:
    if sample_size <= 0 or len(conversations) <= sample_size:
        return list(conversations)
    if sample_size == 1:
        return [conversations[0]]

    last_index = len(conversations) - 1
    indices = {round(position * last_index / (sample_size - 1)) for position in range(sample_size)}
    return [conversations[index] for index in sorted(indices)]


def _profile_terms(conversations: Sequence[ProcessedConversation]) -> Counter[str]:
    counter: Counter[str] = Counter()
    for conversation in conversations:
        text = f"{conversation.customer_problem_text} {conversation.canonical_text}".casefold()
        for term in re.findall(r"[0-9A-Za-z가-힣_]+", text):
            if len(term.replace("_", "")) < _MIN_PROFILE_TERM_LENGTH:
                continue
            if term in _PROFILE_STOPWORDS:
                continue
            counter[term] += 1
    return counter


def _confirmed_domain(payload: dict[str, Any]) -> str:
    value = str(
        payload.get("confirmedDomain") or payload.get("displayName") or payload.get("candidateId") or ""
    ).strip()
    return value or UNKNOWN_ROOT_DOMAIN


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [text for item in value if (text := str(item).strip())]


def _bounded_float(value: object, *, default: float) -> float:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return default
    return max(0.0, min(1.0, float(value)))


def _int_value(value: object) -> int:
    if isinstance(value, int) and not isinstance(value, bool):
        return value
    return 0


__all__ = [
    "GENERIC_ROOT_DOMAIN",
    "RootDomainProfile",
    "UNKNOWN_ROOT_DOMAIN",
    "infer_root_domain_profile",
    "load_confirmed_domain_profile",
    "load_confirmed_domain_profile_from_env",
]
