from __future__ import annotations

import json
import logging
import os
import re
import time
from dataclasses import dataclass
from typing import Any

import httpx

from pipeline.common.config import PipelineRuntimeConfig

DESCRIPTION_ENRICHMENT_ENV = "ML_DESCRIPTION_ENRICHMENT"
NAME_ENRICHMENT_ENV = "ML_NAME_ENRICHMENT"
DISABLE_THINKING_ENV = "ML_LLM_DISABLE_THINKING"
ENABLED_VALUES = {"1", "true", "yes", "on", "local_llm", "llm"}
MAX_EVIDENCE_ITEMS = 6
MAX_EVIDENCE_CHARS = 300
FORBIDDEN_DESCRIPTION_PHRASES = (
    "자동 생성",
    "자동화 워크플로우",
    "클러스터",
    "draft",
    "Draft",
    "generated workflow",
)
FORBIDDEN_NAME_PHRASES = FORBIDDEN_DESCRIPTION_PHRASES + (
    "기타 처리 흐름",
    "일반 문의",
    "고객 문의",
    "처리 요청",
)
NAME_ENTITY_TYPES = {"intent", "workflow"}


@dataclass
class DescriptionEntity:
    entity_type: str
    entity_code: str
    name: str
    description: str
    payload: dict[str, Any]
    evidence: list[dict[str, str]]


def enrich_candidate_descriptions(
    candidate: dict[str, Any],
    runtime_config: PipelineRuntimeConfig,
    logger: logging.Logger | None = None,
) -> dict[str, Any] | None:
    description_mode = _env_mode(DESCRIPTION_ENRICHMENT_ENV)
    name_mode = _env_mode(NAME_ENRICHMENT_ENV)
    description_enabled = description_mode in ENABLED_VALUES
    name_enabled = name_mode in ENABLED_VALUES
    if not description_enabled and not name_enabled:
        return None
    started_at = time.monotonic()
    summary: dict[str, Any] = {
        "enabled": True,
        "mode": description_mode if description_enabled else name_mode,
        "descriptionMode": description_mode if description_enabled else "off",
        "nameMode": name_mode if name_enabled else "off",
        "provider": "openai_compatible",
        "model": runtime_config.llm_model_name,
        "schemaTotalCount": 0,
        "schemaValidCount": 0,
        "schemaFailureCount": 0,
        "evidenceMismatchCount": 0,
        "contentValidationFailureCount": 0,
        "requestFailureCount": 0,
        "abstainCount": 0,
        "appliedCount": 0,
        "fallbackCount": 0,
        "nameTotalCount": 0,
        "nameAppliedCount": 0,
        "nameFallbackCount": 0,
        "descriptionTotalCount": 0,
        "descriptionAppliedCount": 0,
        "descriptionFallbackCount": 0,
        "nameRepairAppliedCount": 0,
    }
    base_url = runtime_config.llm_runtime_base_url
    if not base_url:
        summary["requestFailureCount"] = 1
        summary["fallbackReason"] = "missing_llm_runtime_base_url"
        return summary

    endpoint = f"{base_url.rstrip('/')}/chat/completions"
    headers = {"Content-Type": "application/json"}
    if runtime_config.llm_runtime_api_key:
        headers["Authorization"] = f"Bearer {runtime_config.llm_runtime_api_key}"
    timeout = _timeout_seconds()
    limit = _entity_limit()
    entities = _description_entities(candidate)
    seen_names: dict[str, set[str]] = {entity_type: set() for entity_type in NAME_ENTITY_TYPES}

    with httpx.Client(timeout=timeout) as client:
        if name_enabled:
            for entity in entities:
                if entity.entity_type not in NAME_ENTITY_TYPES:
                    continue
                if _limit_reached(summary, limit):
                    break
                _enrich_entity_field(
                    client,
                    endpoint,
                    headers,
                    runtime_config,
                    entity,
                    field_name="name",
                    summary=summary,
                    logger=logger,
                    seen_names=seen_names,
                )
                seen_names[entity.entity_type].add(str(entity.payload.get("name") or entity.name))

        if description_enabled:
            for entity in entities:
                if _limit_reached(summary, limit):
                    break
                _enrich_entity_field(
                    client,
                    endpoint,
                    headers,
                    runtime_config,
                    entity,
                    field_name="description",
                    summary=summary,
                    logger=logger,
                    seen_names=seen_names,
                )

    summary["durationSeconds"] = round(time.monotonic() - started_at, 4)
    return summary


def _enrich_entity_field(
    client: httpx.Client,
    endpoint: str,
    headers: dict[str, str],
    runtime_config: PipelineRuntimeConfig,
    entity: DescriptionEntity,
    *,
    field_name: str,
    summary: dict[str, Any],
    logger: logging.Logger | None,
    seen_names: dict[str, set[str]],
) -> None:
    _increment(summary, "schemaTotalCount")
    _increment(summary, f"{field_name}TotalCount")
    try:
        response = client.post(
            endpoint,
            headers=headers,
            json=_request_payload(runtime_config.llm_model_name, entity, field_name),
        )
        response.raise_for_status()
        parsed = _parse_response(response.json())
    except (httpx.HTTPError, json.JSONDecodeError, ValueError, TypeError, KeyError) as exc:
        _increment(summary, "requestFailureCount")
        _record_fallback(summary, field_name)
        if logger is not None:
            logger.warning(
                "draft_generation.description_enrichment_failed entity_type=%s entity_code=%s field=%s error=%s",
                entity.entity_type,
                entity.entity_code,
                field_name,
                exc,
            )
        return

    schema_error = _schema_validation_error(parsed, field_name)
    if schema_error is not None:
        _increment(summary, "schemaFailureCount")
        _record_fallback(summary, field_name)
        if logger is not None:
            logger.warning(
                "draft_generation.description_enrichment_invalid_schema "
                "entity_type=%s entity_code=%s field=%s reason=%s",
                entity.entity_type,
                entity.entity_code,
                field_name,
                schema_error,
            )
        return

    _increment(summary, "schemaValidCount")
    content_error = _content_validation_error(parsed, entity.evidence, field_name, entity, seen_names)
    if content_error is not None:
        if content_error == "unknown_evidence_id":
            _increment(summary, "evidenceMismatchCount")
        else:
            _increment(summary, "contentValidationFailureCount")
        if field_name == "name" and _apply_name_repair(entity, runtime_config, seen_names, content_error):
            _increment(summary, "nameRepairAppliedCount")
            return
        _record_fallback(summary, field_name)
        if logger is not None:
            logger.warning(
                "draft_generation.description_enrichment_rejected entity_type=%s entity_code=%s field=%s reason=%s",
                entity.entity_type,
                entity.entity_code,
                field_name,
                content_error,
            )
        return

    if parsed["abstain"]:
        _increment(summary, "abstainCount")
        _record_fallback(summary, field_name)
        return

    previous_value = entity.name if field_name == "name" else entity.description
    value = _normalized_output(parsed[field_name], field_name)
    entity.payload[field_name] = value
    entity.payload[f"{field_name}EnrichmentJson"] = _compact_json(
        {
            "provider": "local_llm",
            "model": runtime_config.llm_model_name,
            "usedEvidenceIds": parsed["usedEvidenceIds"],
            f"previous{field_name.title()}": previous_value,
        }
    )
    if field_name == "name":
        entity.name = value
    _increment(summary, "appliedCount")
    _increment(summary, f"{field_name}AppliedCount")


def _limit_reached(summary: dict[str, Any], limit: int | None) -> bool:
    return limit is not None and int(summary["schemaTotalCount"]) >= limit


def _record_fallback(summary: dict[str, Any], field_name: str) -> None:
    _increment(summary, "fallbackCount")
    _increment(summary, f"{field_name}FallbackCount")


def _increment(summary: dict[str, Any], key: str) -> None:
    summary[key] = int(summary.get(key, 0)) + 1


def _env_mode(name: str) -> str:
    return os.getenv(name, "off").strip().lower()


def _normalized_text(value: str) -> str:
    return " ".join(value.split())


def _normalized_output(value: str, field_name: str) -> str:
    text = _normalized_text(value)
    if field_name != "name":
        return text
    text = text.replace(" / ", " 및 ")
    text = text.replace("/", " 및 ")
    text = text.replace(" - 기타 처리 흐름", " 일반 상담")
    text = text.replace("기타 처리 흐름", "일반 상담")
    text = text.replace("본인확인", "본인 확인")
    text = text.replace("결제확인", "결제 확인")
    text = text.replace("  ", " ")
    return _normalized_text(text)


def _description_entities(candidate: dict[str, Any]) -> list[DescriptionEntity]:
    entities: list[DescriptionEntity] = []
    intent_draft = candidate.get("intentDraft")
    if isinstance(intent_draft, dict):
        for intent in _dict_items(intent_draft.get("intents")):
            entities.append(
                DescriptionEntity(
                    entity_type="intent",
                    entity_code=str(intent.get("intentCode") or ""),
                    name=str(intent.get("name") or ""),
                    description=str(intent.get("description") or ""),
                    payload=intent,
                    evidence=_intent_evidence(intent),
                )
            )

    workflow_draft = candidate.get("workflowDraft")
    if not isinstance(workflow_draft, dict):
        return entities
    for key, entity_type, code_key in (
        ("workflows", "workflow", "workflowCode"),
        ("slots", "slot", "slotCode"),
        ("policies", "policy", "policyCode"),
        ("risks", "risk", "riskCode"),
    ):
        for item in _dict_items(workflow_draft.get(key)):
            entities.append(
                DescriptionEntity(
                    entity_type=entity_type,
                    entity_code=str(item.get(code_key) or ""),
                    name=str(item.get("name") or ""),
                    description=str(item.get("description") or ""),
                    payload=item,
                    evidence=_entity_evidence(item),
                )
            )
    return [entity for entity in entities if entity.entity_code and entity.name and entity.evidence]


def _intent_evidence(intent: dict[str, Any]) -> list[dict[str, str]]:
    evidence = _entity_evidence(intent)
    for case in _dict_items(intent.get("representativeCases")):
        conversation_id = str(case.get("conversationId") or "")
        text = " ".join(
            part
            for part in (
                str(case.get("customerProblemText") or ""),
                str(case.get("canonicalText") or ""),
            )
            if part
        ).strip()
        if conversation_id and text:
            evidence.append({"id": conversation_id, "text": text[:MAX_EVIDENCE_CHARS]})
    return _dedupe_evidence(evidence)


def _entity_evidence(item: dict[str, Any]) -> list[dict[str, str]]:
    raw = _parse_json_value(item.get("evidenceJson"))
    evidence: list[dict[str, str]] = []
    if isinstance(raw, list):
        for index, value in enumerate(raw, start=1):
            if not isinstance(value, dict):
                continue
            evidence_id = _evidence_id(value, index)
            text = _evidence_text(value)
            if evidence_id and text:
                evidence.append({"id": evidence_id, "text": text[:MAX_EVIDENCE_CHARS]})
    elif isinstance(raw, dict):
        for key in ("sampleSegmentTexts", "sampleIntentPhrases"):
            values = raw.get(key)
            if isinstance(values, list):
                for index, value in enumerate(values, start=1):
                    if isinstance(value, str) and value:
                        evidence.append({"id": f"{key}-{index}", "text": value[:MAX_EVIDENCE_CHARS]})
        ids = raw.get("exemplarConversationIds")
        if isinstance(ids, list):
            for value in ids[:MAX_EVIDENCE_ITEMS]:
                if isinstance(value, str) and value:
                    evidence.append({"id": value, "text": f"대표 상담 사례 {value}"})
    graph = _parse_json_value(item.get("graphJson"))
    if isinstance(graph, dict):
        labels = [
            str(node.get("label"))
            for node in _dict_items(graph.get("nodes"))
            if isinstance(node.get("label"), str) and node.get("label")
        ]
        if labels:
            evidence.append({"id": "workflow-graph", "text": " > ".join(labels[:8])[:MAX_EVIDENCE_CHARS]})
    return _dedupe_evidence(evidence)


def _evidence_id(value: dict[str, Any], index: int) -> str:
    for key in ("conversationId", "value"):
        candidate = value.get(key)
        if isinstance(candidate, str) and candidate:
            return candidate
    return f"e{index}"


def _evidence_text(value: dict[str, Any]) -> str:
    item_type = str(value.get("type") or "")
    if item_type == "evidence_span":
        return str(value.get("value") or "").strip()
    if item_type in {"keyword", "exemplar_conv_id", "member_conv_id"}:
        return str(value.get("value") or "").strip()
    for key in ("snippet", "summary", "text", "value"):
        candidate = value.get(key)
        if isinstance(candidate, str) and candidate:
            return candidate.strip()
    return ""


def _request_payload(model_name: str, entity: DescriptionEntity, field_name: str) -> dict[str, Any]:
    evidence_text = "\n".join(f"- id={item['id']} text={item['text']}" for item in entity.evidence[:MAX_EVIDENCE_ITEMS])
    is_name = field_name == "name"
    payload: dict[str, Any] = {
        "model": model_name,
        "temperature": 0.1,
        "max_tokens": 160,
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": f"{field_name}_enrichment",
                "strict": True,
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": [field_name, "usedEvidenceIds", "abstain"],
                    "properties": {
                        field_name: {"type": "string"},
                        "usedEvidenceIds": {"type": "array", "items": {"type": "string"}},
                        "abstain": {"type": "boolean"},
                    },
                },
            },
        },
        "messages": [
            {
                "role": "system",
                "content": (
                    "You rewrite CS workflow draft names and descriptions in Korean. Use only the given evidence. "
                    "Return JSON only. Do not invent facts. Set abstain=true when evidence is insufficient. "
                    "Do not mention clustering, draft generation, automation generation, or evidence ids."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"entityType={entity.entity_type}\n"
                    f"entityCode={entity.entity_code}\n"
                    f"entityName={entity.name}\n"
                    f"currentDescription={entity.description}\n"
                    f"evidence:\n{evidence_text}\n"
                    f"{_field_instruction(is_name)}"
                ),
            },
        ],
    }
    if _disable_thinking_enabled():
        payload["options"] = {"think": False}
    return payload


def _field_instruction(is_name: bool) -> str:
    if is_name:
        return (
            "Write one Korean noun phrase for a reviewer-facing display name. "
            "Use 4-30 characters. Do not use '/', code names, '기타 처리 흐름', or generic names."
        )
    return "Write one concise Korean sentence under 90 characters."


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
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, flags=re.DOTALL | re.IGNORECASE)
    if fenced:
        return fenced.group(1)
    return text


def _schema_validation_error(parsed: dict[str, Any], field_name: str) -> str | None:
    field_value = parsed.get(field_name)
    used_evidence_ids = parsed.get("usedEvidenceIds")
    abstain = parsed.get("abstain")
    if not isinstance(field_value, str):
        return f"{field_name}_not_string"
    if not isinstance(used_evidence_ids, list) or not all(isinstance(item, str) for item in used_evidence_ids):
        return "used_evidence_ids_invalid"
    if not isinstance(abstain, bool):
        return "abstain_not_boolean"
    return None


def _content_validation_error(
    parsed: dict[str, Any],
    evidence: list[dict[str, str]],
    field_name: str,
    entity: DescriptionEntity,
    seen_names: dict[str, set[str]],
) -> str | None:
    value = _normalized_output(parsed[field_name], field_name)
    used_evidence_ids = parsed["usedEvidenceIds"]
    abstain = parsed["abstain"]
    evidence_ids = {item["id"] for item in evidence}
    if not set(used_evidence_ids).issubset(evidence_ids):
        return "unknown_evidence_id"
    if abstain:
        return None
    if not value:
        return f"empty_{field_name}"
    if field_name == "name":
        return _name_validation_error(value, entity, seen_names)
    if any(phrase in value for phrase in FORBIDDEN_DESCRIPTION_PHRASES):
        return "meta_description_phrase"
    if len(value) > 220:
        return "description_too_long"
    return None


def _name_validation_error(value: str, entity: DescriptionEntity, seen_names: dict[str, set[str]]) -> str | None:
    if len(value) < 4:
        return "name_too_short"
    if len(value) > 30:
        return "name_too_long"
    if "/" in value or "\\" in value:
        return "name_list_separator"
    if entity.entity_code and entity.entity_code in value:
        return "name_contains_code"
    if "INTENT" in value.upper() or "WORKFLOW" in value.upper():
        return "name_contains_code"
    if any(phrase in value for phrase in FORBIDDEN_NAME_PHRASES):
        return "generic_or_meta_name"
    if value in seen_names.get(entity.entity_type, set()):
        return "duplicate_name"
    return None


def _apply_name_repair(
    entity: DescriptionEntity,
    runtime_config: PipelineRuntimeConfig,
    seen_names: dict[str, set[str]],
    reason: str,
) -> bool:
    if not _name_needs_repair(entity.name):
        return False
    repair_candidates = _repair_existing_name_candidates(entity.name)
    if not repair_candidates:
        return False
    repaired = ""
    for candidate in repair_candidates:
        if candidate == entity.name:
            continue
        if _name_validation_error(candidate, entity, seen_names) is None:
            repaired = candidate
            break
    if not repaired:
        return False
    used_evidence_ids = [item["id"] for item in entity.evidence[:MAX_EVIDENCE_ITEMS] if item.get("id")]
    if not used_evidence_ids:
        return False
    previous_name = entity.name
    entity.payload["name"] = repaired
    entity.payload["nameEnrichmentJson"] = _compact_json(
        {
            "provider": "deterministic_name_repair",
            "model": runtime_config.llm_model_name,
            "usedEvidenceIds": used_evidence_ids,
            "previousName": previous_name,
            "llmRejectionReason": reason,
        }
    )
    entity.name = repaired
    return True


def _name_needs_repair(value: str) -> bool:
    return any(token in value for token in ("/", "기타 처리 흐름", "본인확인", "결제확인", "·"))


def _repair_existing_name_candidates(value: str) -> list[str]:
    parts = value.split(" - ", maxsplit=1)
    base = _normalized_output(parts[0], "name")
    suffix = parts[1] if len(parts) > 1 else ""
    qualifiers: list[str] = []
    if "본인확인" in suffix or "본인 확인" in suffix:
        qualifiers.append("본인 확인")
    if "결제확인" in suffix or "결제 확인" in suffix:
        qualifiers.append("결제 확인")
    if "상담원" in suffix or "이관" in suffix:
        qualifiers.append("이관")
    if "기타" in suffix:
        qualifiers.append("일반")
    repaired = _normalized_text(" ".join([base, *qualifiers]))
    candidates = [repaired]
    if not qualifiers or "일반" in qualifiers:
        candidates.extend(
            [
                _normalized_text(f"{base} 일반"),
                _normalized_text(f"{base} 처리"),
                _normalized_text(f"{base} 상담"),
            ]
        )
    if len(repaired) <= 30:
        return _unique_names(candidates)
    for qualifier in ("결제 확인", "본인 확인", "이관", "일반"):
        repaired = _normalized_text(repaired.replace(qualifier, ""))
        if len(repaired) <= 30:
            candidates.append(repaired)
            return _unique_names(candidates)
    candidates.append(repaired[:30].rstrip())
    return _unique_names(candidates)


def _unique_names(values: list[str]) -> list[str]:
    output: list[str] = []
    seen: set[str] = set()
    for value in values:
        normalized = _normalized_text(value)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        output.append(normalized)
    return output


def _dedupe_evidence(evidence: list[dict[str, str]]) -> list[dict[str, str]]:
    output: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for item in evidence:
        evidence_id = item.get("id", "").strip()
        text = " ".join(item.get("text", "").split())
        if not evidence_id or not text:
            continue
        key = (evidence_id, text)
        if key in seen:
            continue
        seen.add(key)
        output.append({"id": evidence_id, "text": text[:MAX_EVIDENCE_CHARS]})
        if len(output) >= MAX_EVIDENCE_ITEMS:
            break
    return output


def _dict_items(value: object) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _parse_json_value(value: object) -> object:
    if not isinstance(value, str) or not value:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


def _timeout_seconds() -> float:
    value = os.getenv("ML_DESCRIPTION_ENRICHMENT_TIMEOUT_SECONDS", "30").strip()
    try:
        parsed = float(value)
    except ValueError:
        return 30.0
    return parsed if parsed > 0 else 30.0


def _entity_limit() -> int | None:
    value = os.getenv("ML_DESCRIPTION_ENRICHMENT_LIMIT", "").strip()
    if not value:
        return None
    try:
        parsed = int(value)
    except ValueError:
        return None
    return parsed if parsed > 0 else None


def _disable_thinking_enabled() -> bool:
    return _env_mode(DISABLE_THINKING_ENV) in ENABLED_VALUES


def _compact_json(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


__all__ = ["enrich_candidate_descriptions"]
