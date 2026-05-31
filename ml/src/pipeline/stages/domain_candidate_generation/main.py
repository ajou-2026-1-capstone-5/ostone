from __future__ import annotations

import hashlib
import json
import os
import re
import time
from collections import Counter
from datetime import UTC, datetime
from typing import cast

import httpx

from pipeline.common.artifacts import ensure_stage_directory, write_stage_manifest
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.stages.intent_discovery.io import read_preprocessed_artifact
from pipeline.stages.preprocessing.io import read_stage_context
from pipeline.stages.preprocessing.types import ProcessedConversation

ARTIFACT_NAME = "domain_candidates.json"
PROMPT_VERSION = "domain-candidates.v1"
MIXED_UNKNOWN_ID = "mixed_or_unknown"
MAX_SAMPLE_SIZE = 24
MAX_CANDIDATES = 5
MIN_CANDIDATES = 3
MAX_SNIPPET_CHARS = 360
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
    fallback_terms = _top_terms(sampled)
    generation_error: dict[str, object] | None = None
    candidates: list[dict[str, object]]

    try:
        candidates = _generate_llm_candidates(runtime_config, sampled, fallback_terms, sample_hash)
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
        generation_error = {"type": type(exc).__name__, "message": str(exc)}
        candidates = []

    candidates = _normalize_candidates(candidates, fallback_terms, sampled)
    if not candidates:
        candidates = [_mixed_unknown_candidate(fallback_terms, sampled)]

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
                "domainCandidateFallback": generation_error is not None
                or candidates[0].get("candidateId") == MIXED_UNKNOWN_ID,
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
                "content": "You classify customer-service consultation logs into concise business domains.",
            },
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
    }
    with httpx.Client(timeout=_llm_timeout()) as client:
        response = client.post(endpoint, headers=headers, json=request_payload)
        response.raise_for_status()
    response_payload = response.json()
    content = response_payload["choices"][0]["message"]["content"]
    parsed = json.loads(str(content))
    raw_candidates = parsed.get("candidates")
    if not isinstance(raw_candidates, list):
        raise ValueError("LLM response must contain candidates list.")
    return [cast(dict[str, object], item) for item in raw_candidates if isinstance(item, dict)]


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
                "Each candidate must include displayName, confidence, description, "
                "evidenceTerms, evidenceConversationIds, suggestedDomainLexicon.",
                "Keep displayName short and operator-facing.",
            ],
            "sampleHash": sample_hash,
            "topTerms": fallback_terms,
            "samples": samples,
            "outputSchema": {
                "candidates": [
                    {
                        "displayName": "string",
                        "confidence": 0.0,
                        "description": "string",
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
) -> list[dict[str, object]]:
    normalized: list[dict[str, object]] = []
    seen: set[str] = set()
    sampled_ids = {conversation.id for conversation in sampled}
    for index, candidate in enumerate(candidates[:MAX_CANDIDATES], start=1):
        display_name = _clean_text(candidate.get("displayName") or candidate.get("name"))
        if not display_name:
            continue
        candidate_id = _candidate_id(display_name, index)
        if candidate_id in seen:
            continue
        seen.add(candidate_id)
        evidence_ids = [
            str(value) for value in _object_list(candidate.get("evidenceConversationIds")) if str(value) in sampled_ids
        ][:5]
        normalized.append(
            {
                "candidateId": candidate_id,
                "displayName": display_name,
                "confidence": _bounded_float(candidate.get("confidence"), default=0.5),
                "description": _clean_text(candidate.get("description")) or f"{display_name} 상담 도메인",
                "evidenceTerms": _string_list(candidate.get("evidenceTerms"))[:12] or fallback_terms[:8],
                "evidenceConversationIds": evidence_ids or [conversation.id for conversation in sampled[:3]],
                "suggestedDomainLexicon": _string_list(candidate.get("suggestedDomainLexicon"))[:24]
                or fallback_terms[:12],
            }
        )
    if normalized and all(item["candidateId"] != MIXED_UNKNOWN_ID for item in normalized):
        normalized.append(_mixed_unknown_candidate(fallback_terms, sampled))
    return normalized[:MAX_CANDIDATES] if len(normalized) >= MIN_CANDIDATES else normalized


def _mixed_unknown_candidate(fallback_terms: list[str], sampled: list[ProcessedConversation]) -> dict[str, object]:
    return {
        "candidateId": MIXED_UNKNOWN_ID,
        "displayName": "혼합 또는 미확정",
        "confidence": 0.0,
        "description": "도메인을 확정하기 어렵거나 여러 도메인이 섞인 상담 로그입니다.",
        "evidenceTerms": fallback_terms[:12],
        "evidenceConversationIds": [conversation.id for conversation in sampled[:5]],
        "suggestedDomainLexicon": fallback_terms[:12],
    }


def _deterministic_sample(conversations: list[ProcessedConversation], sample_size: int) -> list[ProcessedConversation]:
    if sample_size <= 0 or len(conversations) <= sample_size:
        return list(conversations)
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
    raw = os.getenv("PIPELINE_DOMAIN_CANDIDATE_LLM_TIMEOUT_SECONDS", "20").strip()
    try:
        parsed = float(raw)
    except ValueError:
        return 20.0
    return max(1.0, min(120.0, parsed))


def _sample_hash(sampled: list[ProcessedConversation]) -> str:
    canonical = json.dumps(
        [{"id": conversation.id, "text": conversation.customer_problem_text} for conversation in sampled],
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _top_terms(sampled: list[ProcessedConversation]) -> list[str]:
    counter: Counter[str] = Counter()
    for conversation in sampled:
        text = f"{conversation.customer_problem_text} {conversation.canonical_text}".casefold()
        for term in re.findall(r"[0-9A-Za-z가-힣_]+", text):
            if len(term.replace("_", "")) < 2 or term in STOPWORDS:
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


def _bounded_float(value: object, *, default: float) -> float:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return default
    return max(0.0, min(1.0, float(value)))


__all__ = ["ARTIFACT_NAME", "run"]
