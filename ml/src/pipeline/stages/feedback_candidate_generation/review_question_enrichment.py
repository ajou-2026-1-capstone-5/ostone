from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass
from typing import Any

import httpx

from pipeline.common.config import PipelineRuntimeConfig

REVIEW_QUESTION_ENRICHMENT_ENV = "ML_REVIEW_QUESTION_ENRICHMENT"
DISABLE_THINKING_ENV = "ML_LLM_DISABLE_THINKING"
ENABLED_VALUES = {"1", "true", "yes", "on", "local_llm", "llm"}
MAX_EVIDENCE_ITEMS = 8
MAX_EVIDENCE_CHARS = 420
CHOICE_KEYS = ("must_link", "cannot_link", "unsure")
FORBIDDEN_PHRASES = (
    "자동 생성",
    "클러스터",
    "cluster",
    "Cluster",
    "label",
    "Label",
    "workflow candidate",
    "근거를 찾을 수 없습니다",
    "업무 추정 불가",
)
BROKEN_LABEL_PATTERNS = (
    "지역 이동할 원화로 견적",
    "원화로 견적",
    "가요 리츠칼튼 있네 예약",
    "리츠칼튼 있네 예약",
    "지불하나 정보확인",
)


@dataclass(frozen=True)
class ReviewQuestionEvidence:
    evidence_id: str
    text: str


def enrich_review_questions(
    questions: list[dict[str, object]],
    runtime_config: PipelineRuntimeConfig,
    logger: logging.Logger | None = None,
) -> dict[str, Any]:
    mode = _env_mode(REVIEW_QUESTION_ENRICHMENT_ENV)
    enabled = mode in ENABLED_VALUES
    started_at = time.monotonic()
    summary: dict[str, Any] = {
        "enabled": enabled,
        "mode": mode,
        "provider": "openai_compatible" if enabled else "disabled",
        "model": runtime_config.llm_model_name,
        "schemaTotalCount": 0,
        "schemaValidCount": 0,
        "schemaFailureCount": 0,
        "groundingFailureCount": 0,
        "contentValidationFailureCount": 0,
        "requestFailureCount": 0,
        "abstainCount": 0,
        "appliedCount": 0,
        "fallbackCount": 0,
        "lowPriorityCount": 0,
    }
    if not enabled:
        summary["durationSeconds"] = 0.0
        return summary

    base_url = runtime_config.llm_runtime_base_url
    if not base_url:
        summary["requestFailureCount"] = 1
        summary["fallbackCount"] = len(questions)
        summary["fallbackReason"] = "missing_llm_runtime_base_url"
        summary["durationSeconds"] = round(time.monotonic() - started_at, 4)
        return summary

    endpoint = f"{base_url.rstrip('/')}/chat/completions"
    headers = {"Content-Type": "application/json"}
    if runtime_config.llm_runtime_api_key:
        headers["Authorization"] = f"Bearer {runtime_config.llm_runtime_api_key}"

    limit = _question_limit()
    with httpx.Client(timeout=_timeout_seconds()) as client:
        for question in questions[:limit]:
            _enrich_question(client, endpoint, headers, runtime_config, question, summary, logger)

    if limit < len(questions):
        summary["skippedByLimitCount"] = len(questions) - limit
    summary["durationSeconds"] = round(time.monotonic() - started_at, 4)
    return summary


def _enrich_question(
    client: httpx.Client,
    endpoint: str,
    headers: dict[str, str],
    runtime_config: PipelineRuntimeConfig,
    question: dict[str, object],
    summary: dict[str, Any],
    logger: logging.Logger | None,
) -> None:
    evidence = _question_evidence(question)
    _increment(summary, "schemaTotalCount")
    try:
        response = client.post(
            endpoint,
            headers=headers,
            json=_request_payload(runtime_config.llm_model_name, question, evidence),
        )
        response.raise_for_status()
        parsed = _parse_response(response.json())
    except (httpx.HTTPError, ValueError, TypeError, KeyError) as exc:
        _increment(summary, "requestFailureCount")
        _record_fallback(question, summary, "request_failure")
        if logger is not None:
            logger.warning(
                "feedback_candidate_generation.review_question_enrichment_failed question_id=%s error=%s",
                question.get("questionId"),
                exc,
            )
        return

    schema_error = _schema_validation_error(parsed)
    if schema_error is not None:
        _increment(summary, "schemaFailureCount")
        _record_fallback(question, summary, schema_error)
        return

    _increment(summary, "schemaValidCount")
    validation_error = _content_validation_error(parsed, evidence)
    if validation_error is not None:
        if validation_error == "unknown_evidence_id" or validation_error == "missing_grounding_evidence":
            _increment(summary, "groundingFailureCount")
        else:
            _increment(summary, "contentValidationFailureCount")
        _record_fallback(question, summary, validation_error)
        return

    if parsed["abstain"]:
        _apply_abstain(question, parsed, summary, runtime_config)
        return

    _apply_enrichment(question, parsed, runtime_config, summary)


def _question_evidence(question: dict[str, object]) -> list[ReviewQuestionEvidence]:
    evidence: list[ReviewQuestionEvidence] = []
    source_context = _dict_value(question.get("sourceReviewContext"))
    target_context = _dict_value(question.get("targetReviewContext"))
    _append_evidence(evidence, "source.snippet", str(question.get("sourceSnippet") or ""))
    _append_evidence(evidence, "target.snippet", str(question.get("targetSnippet") or ""))
    _append_context_evidence(evidence, "source", source_context)
    _append_context_evidence(evidence, "target", target_context)
    _append_evidence(evidence, "pair.reason", str(question.get("reasonLabel") or question.get("reason") or ""))
    return evidence[:MAX_EVIDENCE_ITEMS]


def _append_context_evidence(
    evidence: list[ReviewQuestionEvidence],
    prefix: str,
    context: dict[str, object],
) -> None:
    parts = [
        str(context.get("summary") or ""),
        str(context.get("action") or ""),
        str(context.get("object") or ""),
        str(context.get("intentType") or ""),
    ]
    _append_evidence(evidence, f"{prefix}.metadata", " ".join(part for part in parts if part))
    _append_evidence(evidence, f"{prefix}.logExcerpt", str(context.get("logExcerpt") or ""))
    for index, signal in enumerate(_string_list(context.get("signals")), start=1):
        _append_evidence(evidence, f"{prefix}.signal.{index}", signal)


def _append_evidence(evidence: list[ReviewQuestionEvidence], evidence_id: str, text: str) -> None:
    normalized = _normalized_text(text)[:MAX_EVIDENCE_CHARS]
    if normalized and all(item.evidence_id != evidence_id for item in evidence):
        evidence.append(ReviewQuestionEvidence(evidence_id=evidence_id, text=normalized))


def _request_payload(
    model_name: str,
    question: dict[str, object],
    evidence: list[ReviewQuestionEvidence],
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": model_name,
        "temperature": 0.1,
        "max_tokens": 520,
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "review_question_enrichment",
                "strict": True,
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": [
                        "questionType",
                        "sourceTitle",
                        "targetTitle",
                        "sourceSummary",
                        "targetSummary",
                        "commonGround",
                        "keyDifferences",
                        "operatorQuestion",
                        "choiceExplanations",
                        "usedEvidenceIds",
                        "abstain",
                        "abstainReason",
                    ],
                    "properties": {
                        "questionType": {"type": "string", "enum": list(CHOICE_KEYS)},
                        "sourceTitle": {"type": "string"},
                        "targetTitle": {"type": "string"},
                        "sourceSummary": {"type": "string"},
                        "targetSummary": {"type": "string"},
                        "commonGround": {"type": "string"},
                        "keyDifferences": {"type": "array", "items": {"type": "string"}},
                        "operatorQuestion": {"type": "string"},
                        "choiceExplanations": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": list(CHOICE_KEYS),
                            "properties": {key: {"type": "string"} for key in CHOICE_KEYS},
                        },
                        "usedEvidenceIds": {"type": "array", "items": {"type": "string"}},
                        "abstain": {"type": "boolean"},
                        "abstainReason": {"type": "string"},
                    },
                },
            },
        },
        "messages": [
            {
                "role": "system",
                "content": (
                    "You rewrite Korean CS feedback review questions for a human operator. "
                    "Use only the supplied evidence ids and text. Do not decide the final answer. "
                    "Return JSON only. Set abstain=true when evidence is insufficient. "
                    "Do not mention clustering, labels, generation, or internal pipeline details."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "currentQuestion": question.get("questionText"),
                        "recommendedConstraintType": question.get("recommendedConstraintType"),
                        "reason": question.get("reason"),
                        "evidence": [
                            {"id": item.evidence_id, "text": item.text} for item in evidence[:MAX_EVIDENCE_ITEMS]
                        ],
                        "task": (
                            "Rewrite the pair into operator-facing context: concise titles, one-sentence "
                            "summaries, common ground, concrete differences, a neutral operator question, "
                            "and explanations for each choice."
                        ),
                    },
                    ensure_ascii=False,
                ),
            },
        ],
    }
    if _disable_thinking_enabled():
        payload["options"] = {"think": False}
    return payload


def _parse_response(payload: dict[str, Any]) -> dict[str, Any]:
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise ValueError("missing choices")
    choice = choices[0]
    if not isinstance(choice, dict):
        raise ValueError("invalid choice")
    message = choice.get("message")
    if not isinstance(message, dict):
        raise ValueError("missing message")
    content = message.get("content")
    if not isinstance(content, str):
        raise ValueError("missing content")
    parsed = json.loads(_json_content(content))
    if not isinstance(parsed, dict):
        raise ValueError("content must be a JSON object")
    return parsed


def _json_content(content: str) -> str:
    text = content.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if len(lines) >= 3 and lines[-1].strip() == "```":
            return "\n".join(lines[1:-1]).strip()
    return text


def _schema_validation_error(parsed: dict[str, Any]) -> str | None:
    string_fields = (
        "questionType",
        "sourceTitle",
        "targetTitle",
        "sourceSummary",
        "targetSummary",
        "commonGround",
        "operatorQuestion",
        "abstainReason",
    )
    for field in string_fields:
        if not isinstance(parsed.get(field), str):
            return f"{field}_not_string"
    if parsed["questionType"] not in CHOICE_KEYS:
        return "question_type_invalid"
    if not isinstance(parsed.get("keyDifferences"), list) or not all(
        isinstance(item, str) for item in parsed["keyDifferences"]
    ):
        return "key_differences_invalid"
    choices = parsed.get("choiceExplanations")
    if not isinstance(choices, dict):
        return "choice_explanations_invalid"
    for key in CHOICE_KEYS:
        if not isinstance(choices.get(key), str):
            return f"{key}_explanation_not_string"
    used_evidence_ids = parsed.get("usedEvidenceIds")
    if not isinstance(used_evidence_ids, list) or not all(isinstance(item, str) for item in used_evidence_ids):
        return "used_evidence_ids_invalid"
    if not isinstance(parsed.get("abstain"), bool):
        return "abstain_not_boolean"
    return None


def _content_validation_error(
    parsed: dict[str, Any],
    evidence: list[ReviewQuestionEvidence],
) -> str | None:
    evidence_ids = {item.evidence_id for item in evidence}
    used_evidence_ids = set(parsed["usedEvidenceIds"])
    if not used_evidence_ids and not parsed["abstain"]:
        return "missing_grounding_evidence"
    if not used_evidence_ids.issubset(evidence_ids):
        return "unknown_evidence_id"
    if parsed["abstain"]:
        return None if _normalized_text(parsed["abstainReason"]) else "missing_abstain_reason"

    fields = [
        parsed["sourceTitle"],
        parsed["targetTitle"],
        parsed["sourceSummary"],
        parsed["targetSummary"],
        parsed["commonGround"],
        parsed["operatorQuestion"],
        *parsed["keyDifferences"],
        *[str(parsed["choiceExplanations"][key]) for key in CHOICE_KEYS],
    ]
    if any(not _normalized_text(field) for field in fields):
        return "empty_enrichment_field"
    if len(parsed["sourceTitle"]) > 60 or len(parsed["targetTitle"]) > 60:
        return "title_too_long"
    if len(parsed["operatorQuestion"]) > 180:
        return "operator_question_too_long"
    if len(parsed["keyDifferences"]) > 5:
        return "too_many_key_differences"
    if any(_contains_forbidden_content(field) for field in fields):
        return "forbidden_or_broken_label"
    return None


def _contains_forbidden_content(value: str) -> bool:
    normalized = _normalized_text(value)
    if any(phrase in normalized for phrase in FORBIDDEN_PHRASES):
        return True
    return any(pattern in normalized for pattern in BROKEN_LABEL_PATTERNS)


def _apply_enrichment(
    question: dict[str, object],
    parsed: dict[str, Any],
    runtime_config: PipelineRuntimeConfig,
    summary: dict[str, Any],
) -> None:
    question["questionText"] = _normalized_text(parsed["operatorQuestion"])
    question["questionType"] = parsed["questionType"]
    question["sourceTitle"] = _normalized_text(parsed["sourceTitle"])
    question["targetTitle"] = _normalized_text(parsed["targetTitle"])
    question["sourceSummary"] = _normalized_text(parsed["sourceSummary"])
    question["targetSummary"] = _normalized_text(parsed["targetSummary"])
    question["commonGround"] = _normalized_text(parsed["commonGround"])
    question["keyDifferences"] = [_normalized_text(item) for item in parsed["keyDifferences"]]
    question["operatorQuestion"] = _normalized_text(parsed["operatorQuestion"])
    question["choiceExplanations"] = {
        key: _normalized_text(str(parsed["choiceExplanations"][key])) for key in CHOICE_KEYS
    }
    question["reviewQuestionEnrichmentJson"] = _compact_json(
        {
            "provider": "local_llm",
            "model": runtime_config.llm_model_name,
            "usedEvidenceIds": parsed["usedEvidenceIds"],
            "status": "applied",
        }
    )
    question["enrichmentStatus"] = "applied"
    _update_context_summary(question.get("sourceReviewContext"), parsed["sourceTitle"], parsed["sourceSummary"])
    _update_context_summary(question.get("targetReviewContext"), parsed["targetTitle"], parsed["targetSummary"])
    _increment(summary, "appliedCount")


def _apply_abstain(
    question: dict[str, object],
    parsed: dict[str, Any],
    summary: dict[str, Any],
    runtime_config: PipelineRuntimeConfig,
) -> None:
    previous_priority = str(question.get("priority") or "NORMAL")
    question["priority"] = "LOW"
    question["abstainReason"] = _normalized_text(parsed["abstainReason"])
    question["reviewQuestionEnrichmentJson"] = _compact_json(
        {
            "provider": "local_llm",
            "model": runtime_config.llm_model_name,
            "usedEvidenceIds": parsed["usedEvidenceIds"],
            "status": "abstained",
            "previousPriority": previous_priority,
        }
    )
    question["enrichmentStatus"] = "abstained"
    _increment(summary, "abstainCount")
    _increment(summary, "lowPriorityCount")


def _update_context_summary(context: object, title: str, summary: str) -> None:
    if not isinstance(context, dict):
        return
    context["summary"] = _normalized_text(title)
    context["enrichedSummary"] = _normalized_text(summary)


def _record_fallback(question: dict[str, object], summary: dict[str, Any], reason: str) -> None:
    question["enrichmentStatus"] = "fallback"
    question["enrichmentFallbackReason"] = reason
    _increment(summary, "fallbackCount")


def _increment(summary: dict[str, Any], key: str) -> None:
    summary[key] = int(summary.get(key, 0)) + 1


def _dict_value(value: object) -> dict[str, object]:
    return value if isinstance(value, dict) else {}


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [text for item in value if (text := str(item).strip())]


def _normalized_text(value: str) -> str:
    return " ".join(str(value or "").split())


def _compact_json(payload: dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def _env_mode(name: str) -> str:
    return os.getenv(name, "off").strip().lower()


def _timeout_seconds() -> float:
    raw = os.getenv("ML_REVIEW_QUESTION_ENRICHMENT_TIMEOUT_SECONDS", "30").strip()
    try:
        value = float(raw)
    except ValueError:
        return 30.0
    return value if value > 0 else 30.0


def _question_limit() -> int:
    raw = os.getenv("ML_REVIEW_QUESTION_ENRICHMENT_LIMIT", "").strip()
    if not raw:
        return 50
    try:
        value = int(raw)
    except ValueError:
        return 50
    return max(0, min(50, value))


def _disable_thinking_enabled() -> bool:
    return _env_mode(DISABLE_THINKING_ENV) in {"1", "true", "yes", "on"}


__all__ = ["enrich_review_questions"]
