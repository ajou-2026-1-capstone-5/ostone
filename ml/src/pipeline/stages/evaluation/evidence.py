from __future__ import annotations

import json
from typing import Any

from .thresholds import EVIDENCE_SUFFICIENCY_UNSUPPORTED_FIELD_LIMIT


def _evidence_coverage(items: list[dict[str, Any]]) -> float:
    grounded_items = [item for item in items if not _needs_review(item)]
    if not grounded_items:
        return 1.0
    supported = sum(1 for item in grounded_items if _has_evidence(item))
    return supported / len(grounded_items)


def _evidence_sufficiency_summary(
    intents: list[dict[str, Any]],
    workflows: list[dict[str, Any]],
    slots: list[dict[str, Any]],
    policies: list[dict[str, Any]],
    risks: list[dict[str, Any]],
) -> dict[str, Any]:
    specs: tuple[tuple[str, list[dict[str, Any]], tuple[str, ...]], ...] = (
        ("intent", intents, ("name", "description", "entryConditionJson")),
        ("workflow", workflows, ("name", "description", "graphJson", "routeConditionJson")),
        ("slot", slots, ("name", "description", "validationRuleJson")),
        ("policy", policies, ("name", "description", "conditionJson", "actionJson")),
        ("risk", risks, ("name", "description", "conditionJson", "mitigationJson")),
    )
    total = 0
    supported = 0
    unsupported_fields: list[dict[str, str]] = []
    for entity_type, items, fields in specs:
        for item in items:
            evidence_ref_count = _evidence_ref_count(item)
            for field in fields:
                if not _field_has_content(item, field):
                    continue
                total += 1
                if _field_has_sufficient_evidence(item, field, evidence_ref_count):
                    supported += 1
                    continue
                if len(unsupported_fields) < EVIDENCE_SUFFICIENCY_UNSUPPORTED_FIELD_LIMIT:
                    unsupported_fields.append(
                        {
                            "entityType": entity_type,
                            "entityCode": _entity_code(item),
                            "field": field,
                        }
                    )
    score = supported / total if total > 0 else 1.0
    return {
        "score": score,
        "supportedFieldCount": supported,
        "totalFieldCount": total,
        "unsupportedFieldCount": total - supported,
        "unsupportedFields": unsupported_fields,
    }


def _field_has_sufficient_evidence(item: dict[str, Any], field: str, evidence_ref_count: int) -> bool:
    enrichment_key = f"{field}EnrichmentJson"
    if enrichment_key in item:
        return _enrichment_has_used_evidence(item.get(enrichment_key))
    return evidence_ref_count > 0


def _enrichment_has_used_evidence(value: object) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return False
    if not isinstance(parsed, dict):
        return False
    used_ids = parsed.get("usedEvidenceIds")
    return isinstance(used_ids, list) and any(isinstance(item, str) and item for item in used_ids)


def _field_has_content(item: dict[str, Any], field: str) -> bool:
    value = item.get(field)
    if isinstance(value, str):
        text = value.strip()
        if not text or text in {"{}", "[]", "null"}:
            return False
        if field.endswith("Json"):
            try:
                return _evidence_has_content(json.loads(text))
            except json.JSONDecodeError:
                return False
        return True
    return _evidence_has_content(value)


def _evidence_ref_count(item: dict[str, Any]) -> int:
    evidence = item.get("evidenceJson") or item.get("evidenceRefs")
    return _count_evidence_refs(evidence)


def _count_evidence_refs(value: object) -> int:
    if isinstance(value, str):
        if not value.strip():
            return 0
        try:
            return _count_evidence_refs(json.loads(value))
        except json.JSONDecodeError:
            return 1
    if isinstance(value, list):
        return sum(_count_evidence_refs(item) for item in value)
    if isinstance(value, dict):
        list_values = [item for item in value.values() if isinstance(item, list) and item]
        if list_values:
            return sum(_count_evidence_refs(item) for item in list_values)
        return 1 if _evidence_has_content(value) else 0
    return 1 if _evidence_has_content(value) else 0


def _entity_code(item: dict[str, Any]) -> str:
    for key in ("intentCode", "workflowCode", "slotCode", "policyCode", "riskCode"):
        value = item.get(key)
        if isinstance(value, str) and value:
            return value
    return "unknown"


def _has_evidence(item: dict[str, Any]) -> bool:
    evidence = item.get("evidenceJson") or item.get("evidenceRefs")
    if isinstance(evidence, list):
        return _evidence_has_content(evidence)
    if not isinstance(evidence, str) or not evidence.strip():
        return False
    try:
        parsed = json.loads(evidence)
    except json.JSONDecodeError:
        return False
    return _evidence_has_content(parsed)


def _evidence_has_content(value: object) -> bool:
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return True
    if isinstance(value, list):
        return any(_evidence_has_content(item) for item in value)
    if isinstance(value, dict):
        return any(_evidence_has_content(item) for item in value.values())
    return False


def _needs_review(item: dict[str, Any]) -> bool:
    status = str(item.get("reviewStatus") or item.get("status") or "").lower()
    return status == "needs_review"


def _pii_redaction_failed(candidate: dict[str, Any]) -> bool:
    summary = candidate.get("preprocessingSummary")
    return isinstance(summary, dict) and summary.get("piiRedactionFailed") is True


def _has_auto_confirmed_unsupported_policy_or_risk(items: list[dict[str, Any]]) -> bool:
    for item in items:
        if _has_evidence(item):
            continue
        status = str(item.get("reviewStatus") or item.get("status") or "").lower()
        if status in {"approved", "auto_confirmed", "confirmed"}:
            return True
    return False


def _llm_schema_validity(candidate: dict[str, Any]) -> float:
    summary = candidate.get("llmSummary")
    if not isinstance(summary, dict):
        return 1.0
    valid = summary.get("schemaValidCount")
    total = summary.get("schemaTotalCount")
    if isinstance(valid, int) and isinstance(total, int) and total > 0:
        return valid / total
    failed = summary.get("schemaFailureCount")
    if isinstance(failed, int) and failed > 0:
        return 0.0
    return 1.0
