from __future__ import annotations

import re
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass

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

    @property
    def allowed_rule_domains(self) -> tuple[str, ...]:
        if self.root_domain == UNKNOWN_ROOT_DOMAIN:
            return ()
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
            "usesOperatorCategoryMetadata": False,
            "usesDomainSpecificLexicon": False,
        }


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


__all__ = [
    "GENERIC_ROOT_DOMAIN",
    "RootDomainProfile",
    "UNKNOWN_ROOT_DOMAIN",
    "infer_root_domain_profile",
]
