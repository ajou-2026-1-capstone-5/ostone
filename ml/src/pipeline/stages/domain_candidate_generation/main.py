from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
from collections import Counter
from datetime import UTC, datetime
from typing import cast

import httpx

from pipeline.common.artifacts import ensure_stage_directory, write_stage_manifest
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.exceptions import PipelineStageError
from pipeline.stages.intent_discovery.io import read_preprocessed_artifact
from pipeline.stages.preprocessing.io import read_stage_context
from pipeline.stages.preprocessing.types import ProcessedConversation

ARTIFACT_NAME = "domain_candidates.json"
PROMPT_VERSION = "domain-candidates.v1"
MIXED_UNKNOWN_ID = "mixed_or_unknown"
CANDIDATE_KIND_DOMAIN = "domain"
CANDIDATE_KIND_FALLBACK = "fallback"
MAX_SAMPLE_SIZE = 24
MAX_CANDIDATES = 5
MIN_CANDIDATES = 3
MAX_SNIPPET_CHARS = 360
MAX_EVIDENCE_SNIPPETS = 5
MIN_LEXICON_TERM_CHARS = 2
DEFAULT_LLM_TIMEOUT_SECONDS = 240.0
MAX_LLM_TIMEOUT_SECONDS = 300.0
DEFAULT_LLM_MAX_TOKENS: int | None = None
MAX_LLM_MAX_TOKENS = 4096

# fallback 원인 분류. artifact `fallbackReason`과 `혼합 또는 미확정` 후보 metadata 양쪽에 노출한다.
FALLBACK_LLM_REQUEST_FAILURE = "llm_request_failure"
FALLBACK_SCHEMA_VALIDATION_FAILURE = "schema_validation_failure"
FALLBACK_INSUFFICIENT_EVIDENCE = "insufficient_evidence"
FALLBACK_GENUINELY_MIXED = "genuinely_mixed"
_FALLBACK_RATIONALE: dict[str, str] = {
    FALLBACK_LLM_REQUEST_FAILURE: "도메인 분류 모델 호출에 실패해 자동 후보를 생성하지 못했습니다.",
    FALLBACK_SCHEMA_VALIDATION_FAILURE: "도메인 분류 응답 형식이 올바르지 않아 후보를 확정하지 못했습니다.",
    FALLBACK_INSUFFICIENT_EVIDENCE: "도메인을 분리할 만한 상담 근거가 충분하지 않습니다.",
    FALLBACK_GENUINELY_MIXED: "여러 도메인이 섞여 있어 단일 도메인으로 확정하기 어렵습니다.",
}
_MIXED_ALTERNATIVE_RATIONALE = "여러 도메인이 섞여 있거나 확정이 어려울 때 선택하세요."

LOGGER = logging.getLogger(__name__)
STOPWORDS = frozenset(
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
        "혹시",
        "지금",
        "오늘",
        "제가",
        "저는",
        "해주세요",
        "부탁드립니다",
    }
)


def run(upstream_manifest_path: str | None = None) -> dict[str, object]:
    started_at = time.monotonic()
    runtime_config = PipelineRuntimeConfig.from_env()
    stage_context = read_stage_context(upstream_manifest_path, stage_name="domain_candidate_generation")
    output_dir = ensure_stage_directory(stage_context, runtime_config)
    conversations, _flow_signatures = read_preprocessed_artifact(runtime_config, stage_context)
    sampled = _deterministic_sample(conversations, _sample_size())
    sample_hash = _sample_hash(sampled)
    snippet_index = _snippet_index(sampled)
    fallback_terms = _top_terms(sampled)
    generation_error: dict[str, object] | None = None
    failure_reason: str | None = None
    raw_candidates: list[dict[str, object]]

    try:
        raw_candidates = _generate_llm_candidates(runtime_config, sampled, fallback_terms, sample_hash)
    except httpx.HTTPError as exc:
        if not _allow_generation_fallback(runtime_config):
            raise PipelineStageError("Domain candidate LLM generation failed.") from exc
        generation_error = {"type": type(exc).__name__, "message": str(exc)}
        failure_reason = FALLBACK_LLM_REQUEST_FAILURE
        raw_candidates = []
    except (ValueError, KeyError, TypeError) as exc:
        if not _allow_generation_fallback(runtime_config):
            raise PipelineStageError("Domain candidate LLM generation failed.") from exc
        generation_error = {"type": type(exc).__name__, "message": str(exc)}
        # LLM 미설정으로 인한 fallback은 실패가 아니라 근거 기반 분류로 넘긴다.
        failure_reason = None if str(exc) == "missing_llm_runtime_base_url" else FALLBACK_SCHEMA_VALIDATION_FAILURE
        raw_candidates = []

    domain_candidates = _normalize_candidates(raw_candidates, fallback_terms, sampled, snippet_index)
    fallback_reason = _resolve_fallback_reason(failure_reason, len(domain_candidates), len(sampled))
    candidates = list(domain_candidates)
    if len(candidates) < MAX_CANDIDATES:
        candidates.append(
            _mixed_unknown_candidate(
                fallback_terms,
                sampled,
                snippet_index,
                fallback_reason if not domain_candidates else None,
            )
        )

    payload: dict[str, object] = {
        "schemaVersion": "domain-candidates.v1",
        "stage": "domain_candidate_generation",
        "generatedAt": datetime.now(UTC).isoformat(),
        "promptVersion": PROMPT_VERSION,
        "modelName": runtime_config.llm_model_name,
        "provider": "openai_compatible" if runtime_config.llm_runtime_base_url else "fallback",
        "sampleHash": sample_hash,
        "sampledConversationIds": [conversation.id for conversation in sampled],
        "candidateCount": len(candidates),
        "candidates": candidates,
        "fallbackCandidateId": MIXED_UNKNOWN_ID,
        "fallbackReason": fallback_reason,
        "generationError": generation_error,
        "durationSeconds": round(time.monotonic() - started_at, 4),
    }
    artifact_path = output_dir / ARTIFACT_NAME
    artifact_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    manifest_path = write_stage_manifest(
        stage_context,
        runtime_config,
        {
            "upstream_manifest_path": upstream_manifest_path,
            "domainCandidatesPath": artifact_path.name,
            "recordCount": len(candidates),
            "metrics": {
                "domainCandidateCount": len(candidates),
                "realDomainCandidateCount": len(domain_candidates),
                "domainCandidateFallback": fallback_reason is not None,
                "domainCandidateFallbackReason": fallback_reason,
            },
        },
    )
    return {"artifact_manifest_path": str(manifest_path.resolve())}


def _generate_llm_candidates(
    runtime_config: PipelineRuntimeConfig,
    sampled: list[ProcessedConversation],
    fallback_terms: list[str],
    sample_hash: str,
) -> list[dict[str, object]]:
    base_url = runtime_config.llm_runtime_base_url
    if not base_url:
        raise ValueError("missing_llm_runtime_base_url")
    endpoint = f"{base_url.rstrip('/')}/chat/completions"
    headers = {"Content-Type": "application/json"}
    if runtime_config.llm_runtime_api_key:
        headers["Authorization"] = f"Bearer {runtime_config.llm_runtime_api_key}"
    prompt = _prompt(sampled, fallback_terms, sample_hash)
    request_payload = {
        "model": runtime_config.llm_model_name,
        "temperature": 0.1,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You classify customer-service consultation logs into concise business domains. "
                    "Return only the requested JSON object. Do not include analysis or markdown."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
        "chat_template_kwargs": {"enable_thinking": False},
        "options": {"think": False},
    }
    max_tokens = _llm_max_tokens()
    if max_tokens is not None:
        request_payload["max_tokens"] = max_tokens
    with httpx.Client(timeout=_llm_timeout()) as client:
        response = client.post(endpoint, headers=headers, json=request_payload)
        response.raise_for_status()
    response_payload = response.json()
    choice = response_payload["choices"][0]
    content = choice["message"]["content"]
    parsed = _parse_llm_json_response(content, choice.get("finish_reason"))
    raw_candidates = parsed.get("candidates")
    if not isinstance(raw_candidates, list):
        raise ValueError("LLM response must contain candidates list.")
    return [cast(dict[str, object], item) for item in raw_candidates if isinstance(item, dict)]


def _parse_llm_json_response(content: object, finish_reason: object) -> dict[str, object]:
    content_text = str(content)
    try:
        parsed = json.loads(content_text)
    except json.JSONDecodeError as exc:
        message = (
            "LLM domain candidate response was not valid JSON "
            f"finish_reason={finish_reason!r} content_length={len(content_text)}"
        )
        if finish_reason == "length":
            message = (
                "LLM domain candidate response was truncated before valid JSON completed "
                f"content_length={len(content_text)}"
            )
        LOGGER.warning(message)
        raise ValueError(message) from exc
    if not isinstance(parsed, dict):
        raise ValueError("LLM response must be a JSON object.")
    return cast(dict[str, object], parsed)


def _prompt(sampled: list[ProcessedConversation], fallback_terms: list[str], sample_hash: str) -> str:
    samples = [
        {
            "conversationId": conversation.id,
            "text": _snippet(conversation.customer_problem_text or conversation.canonical_text),
        }
        for conversation in sampled
    ]
    return json.dumps(
        {
            "task": "Return 3 to 5 candidate domains for these Korean CS consultation logs.",
            "rules": [
                "Do not use a fixed taxonomy; infer natural business-domain labels from evidence.",
                "Each candidate must include displayName, confidence, description, rationale, "
                "evidenceTerms, evidenceConversationIds, suggestedDomainLexicon.",
                "Keep displayName short and operator-facing.",
                "rationale: one short Korean sentence an operator can read explaining why these logs fit this domain.",
                "evidenceConversationIds must reference the provided sample conversationIds.",
                "Return JSON only. Do not include reasoning, explanations, or markdown.",
            ],
            "thinking": "disabled",
            "sampleHash": sample_hash,
            "topTerms": fallback_terms,
            "samples": samples,
            "outputSchema": {
                "candidates": [
                    {
                        "displayName": "string",
                        "confidence": 0.0,
                        "description": "string",
                        "rationale": "string",
                        "evidenceTerms": ["string"],
                        "evidenceConversationIds": ["string"],
                        "suggestedDomainLexicon": ["string"],
                    }
                ]
            },
        },
        ensure_ascii=False,
    )


def _normalize_candidates(
    candidates: list[dict[str, object]],
    fallback_terms: list[str],
    sampled: list[ProcessedConversation],
    snippet_index: dict[str, str],
) -> list[dict[str, object]]:
    """LLM 후보를 정규화한 실질 domain 후보 목록을 돌려준다. `혼합 또는 미확정` 후보는 붙이지 않는다."""
    normalized: list[dict[str, object]] = []
    seen: set[str] = set()
    sampled_ids = {conversation.id for conversation in sampled}
    for index, candidate in enumerate(candidates[:MAX_CANDIDATES], start=1):
        display_name = _clean_text(candidate.get("displayName") or candidate.get("name"))
        if not display_name:
            continue
        candidate_id = _candidate_id(display_name, index)
        if candidate_id in seen or candidate_id == MIXED_UNKNOWN_ID:
            continue
        seen.add(candidate_id)
        evidence_ids = [
            str(value) for value in _object_list(candidate.get("evidenceConversationIds")) if str(value) in sampled_ids
        ][:MAX_EVIDENCE_SNIPPETS]
        if not evidence_ids:
            evidence_ids = [conversation.id for conversation in sampled[:3]]
        evidence_terms = _clean_lexicon(candidate.get("evidenceTerms")) or fallback_terms[:8]
        normalized.append(
            {
                "candidateId": candidate_id,
                "displayName": display_name,
                "confidence": _bounded_float(candidate.get("confidence"), default=0.5),
                "description": _clean_text(candidate.get("description")) or f"{display_name} 상담 도메인",
                "rationale": _clean_text(candidate.get("rationale")) or _synth_rationale(display_name, evidence_terms),
                "kind": CANDIDATE_KIND_DOMAIN,
                "evidenceTerms": evidence_terms[:12],
                "evidenceConversationIds": evidence_ids,
                "evidenceSnippets": _evidence_snippets(evidence_ids, snippet_index),
                "suggestedDomainLexicon": _clean_lexicon(candidate.get("suggestedDomainLexicon"))[:24]
                or fallback_terms[:12],
            }
        )
    return _prune_generic_terms(normalized)


def _prune_generic_terms(candidates: list[dict[str, object]]) -> list[dict[str, object]]:
    """후보 간 절반을 초과해 등장하는 일반어를 각 후보 lexicon에서 제거한다(후보 lexicon은 비우지 않는다)."""
    if len(candidates) < 2:
        return candidates
    for field in ("evidenceTerms", "suggestedDomainLexicon"):
        counts: Counter[str] = Counter()
        for candidate in candidates:
            counts.update(set(cast(list[str], candidate[field])))
        generic = {term for term, count in counts.items() if count * 2 > len(candidates)}
        if not generic:
            continue
        for candidate in candidates:
            terms = cast(list[str], candidate[field])
            pruned = [term for term in terms if term not in generic]
            if pruned:
                candidate[field] = pruned
    return candidates


def _resolve_fallback_reason(failure_reason: str | None, domain_candidate_count: int, sample_count: int) -> str | None:
    if domain_candidate_count > 0:
        return None
    if failure_reason is not None:
        return failure_reason
    if sample_count < MIN_CANDIDATES:
        return FALLBACK_INSUFFICIENT_EVIDENCE
    return FALLBACK_GENUINELY_MIXED


def _mixed_unknown_candidate(
    fallback_terms: list[str],
    sampled: list[ProcessedConversation],
    snippet_index: dict[str, str],
    fallback_reason: str | None,
) -> dict[str, object]:
    evidence_ids = [conversation.id for conversation in sampled[:MAX_EVIDENCE_SNIPPETS]]
    rationale = (
        _FALLBACK_RATIONALE.get(fallback_reason, _MIXED_ALTERNATIVE_RATIONALE)
        if fallback_reason
        else _MIXED_ALTERNATIVE_RATIONALE
    )
    return {
        "candidateId": MIXED_UNKNOWN_ID,
        "displayName": "혼합 또는 미확정",
        "confidence": 0.0,
        "description": "도메인을 확정하기 어렵거나 여러 도메인이 섞인 상담 로그입니다.",
        "rationale": rationale,
        "kind": CANDIDATE_KIND_FALLBACK,
        "isFallback": True,
        "fallbackReason": fallback_reason,
        "evidenceTerms": fallback_terms[:12],
        "evidenceConversationIds": evidence_ids,
        "evidenceSnippets": _evidence_snippets(evidence_ids, snippet_index),
        "suggestedDomainLexicon": fallback_terms[:12],
    }


def _deterministic_sample(conversations: list[ProcessedConversation], sample_size: int) -> list[ProcessedConversation]:
    if sample_size <= 0 or len(conversations) <= sample_size:
        return list(conversations)
    if sample_size == 1:
        return [conversations[(len(conversations) - 1) // 2]]
    last_index = len(conversations) - 1
    indices = {round(position * last_index / (sample_size - 1)) for position in range(sample_size)}
    return [conversations[index] for index in sorted(indices)]


def _sample_size() -> int:
    raw = os.getenv("PIPELINE_DOMAIN_CANDIDATE_SAMPLE_SIZE", "").strip()
    if not raw:
        return MAX_SAMPLE_SIZE
    try:
        parsed = int(raw)
    except ValueError:
        return MAX_SAMPLE_SIZE
    return max(1, min(80, parsed))


def _llm_timeout() -> float:
    raw = os.getenv("PIPELINE_DOMAIN_CANDIDATE_LLM_TIMEOUT_SECONDS", str(DEFAULT_LLM_TIMEOUT_SECONDS)).strip()
    try:
        parsed = float(raw)
    except ValueError:
        return DEFAULT_LLM_TIMEOUT_SECONDS
    return max(1.0, min(MAX_LLM_TIMEOUT_SECONDS, parsed))


def _llm_max_tokens() -> int | None:
    raw = os.getenv("PIPELINE_DOMAIN_CANDIDATE_LLM_MAX_TOKENS", "").strip()
    if not raw:
        return DEFAULT_LLM_MAX_TOKENS
    try:
        parsed = int(raw)
    except ValueError:
        return DEFAULT_LLM_MAX_TOKENS
    if parsed <= 0:
        return None
    return min(MAX_LLM_MAX_TOKENS, parsed)


def _allow_generation_fallback(runtime_config: PipelineRuntimeConfig) -> bool:
    raw = os.getenv("PIPELINE_DOMAIN_CANDIDATE_ALLOW_LLM_FALLBACK", "").strip().lower()
    if raw in {"1", "true", "yes", "y", "on"}:
        return True
    if raw in {"0", "false", "no", "n", "off"}:
        return False
    return not bool(runtime_config.llm_runtime_base_url)


def _sample_hash(sampled: list[ProcessedConversation]) -> str:
    canonical = json.dumps(
        [{"id": conversation.id, "text": conversation.customer_problem_text} for conversation in sampled],
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _snippet_index(sampled: list[ProcessedConversation]) -> dict[str, str]:
    index: dict[str, str] = {}
    for conversation in sampled:
        snippet = _snippet(conversation.customer_problem_text or conversation.canonical_text)
        if snippet:
            index[conversation.id] = snippet
    return index


def _evidence_snippets(evidence_ids: list[str], snippet_index: dict[str, str]) -> list[dict[str, str]]:
    snippets: list[dict[str, str]] = []
    for conversation_id in evidence_ids[:MAX_EVIDENCE_SNIPPETS]:
        snippet = snippet_index.get(conversation_id)
        if snippet:
            snippets.append({"conversationId": conversation_id, "snippet": snippet})
    return snippets


def _synth_rationale(display_name: str, evidence_terms: list[str]) -> str:
    terms = [term for term in evidence_terms[:3] if term]
    if terms:
        return f"{display_name} 관련 표현({', '.join(terms)})이 반복적으로 나타납니다."
    return f"{display_name} 관련 상담이 반복적으로 나타납니다."


def _top_terms(sampled: list[ProcessedConversation]) -> list[str]:
    counter: Counter[str] = Counter()
    for conversation in sampled:
        text = f"{conversation.customer_problem_text} {conversation.canonical_text}".casefold()
        for term in re.findall(r"[0-9A-Za-z가-힣_]+", text):
            if len(term.replace("_", "")) < MIN_LEXICON_TERM_CHARS or term in STOPWORDS:
                continue
            counter[term] += 1
    return [term for term, _count in counter.most_common(24)]


def _candidate_id(display_name: str, index: int) -> str:
    slug = re.sub(r"[^0-9A-Za-z가-힣_]+", "_", display_name.strip().casefold()).strip("_")
    return slug[:48] or f"domain_{index}"


def _snippet(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()[:MAX_SNIPPET_CHARS]


def _clean_text(value: object) -> str:
    return str(value or "").strip()


def _object_list(value: object) -> list[object]:
    return value if isinstance(value, list) else []


def _string_list(value: object) -> list[str]:
    output: list[str] = []
    for item in _object_list(value):
        text = str(item).strip()
        if text:
            output.append(text)
    return output


def _clean_lexicon(value: object) -> list[str]:
    """lexicon/evidenceTerms에서 stopword와 길이 미달 토큰을 제거하고 순서를 보존해 중복 제거한다."""
    cleaned: list[str] = []
    seen: set[str] = set()
    for term in _string_list(value):
        if term in STOPWORDS or len(term.replace("_", "")) < MIN_LEXICON_TERM_CHARS:
            continue
        if term in seen:
            continue
        seen.add(term)
        cleaned.append(term)
    return cleaned


def _bounded_float(value: object, *, default: float) -> float:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return default
    return max(0.0, min(1.0, float(value)))


__all__ = ["ARTIFACT_NAME", "run"]
