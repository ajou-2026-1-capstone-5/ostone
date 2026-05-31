from __future__ import annotations

import json
from typing import Any, cast


def _mapping_rate(intents: list[dict[str, Any]], workflows: list[dict[str, Any]]) -> float:
    if not intents or not workflows:
        return 0.0
    intent_codes = {item.get("intentCode") for item in intents if isinstance(item.get("intentCode"), str)}
    if not intent_codes:
        return 0.0
    mapped_workflows = sum(1 for workflow in workflows if workflow.get("intentCode") in intent_codes)
    return mapped_workflows / len(workflows)


def _metric(candidate: dict[str, Any], key: str) -> float | None:
    value = _metric_value(candidate.get("evaluationInputs"), key)
    if value is None:
        value = _metric_value(candidate.get("evaluationSummary"), key)
    if value is None:
        return None
    return value


def _bool_metric(candidate: dict[str, Any], key: str) -> bool | None:
    value = _bool_metric_value(candidate.get("evaluationInputs"), key)
    if value is None:
        value = _bool_metric_value(candidate.get("evaluationSummary"), key)
    return value


def _bool_metric_value(payload: object, key: str) -> bool | None:
    if not isinstance(payload, dict):
        return None
    value = payload.get(key)
    return value if isinstance(value, bool) else None


def _metric_value(payload: object, key: str) -> float | None:
    if not isinstance(payload, dict):
        return None
    value = payload.get(key)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    return None


def _intent_items(candidate: dict[str, Any]) -> list[dict[str, Any]]:
    intent_draft = candidate.get("intentDraft")
    if not isinstance(intent_draft, dict):
        return []
    return _dict_items(intent_draft.get("intents"))


def _workflow_items(candidate: dict[str, Any]) -> list[dict[str, Any]]:
    workflow_draft = candidate.get("workflowDraft")
    if not isinstance(workflow_draft, dict):
        return []
    return _dict_items(workflow_draft.get("workflows"))


def _slot_items(candidate: dict[str, Any]) -> list[dict[str, Any]]:
    workflow_draft = candidate.get("workflowDraft")
    if not isinstance(workflow_draft, dict):
        return []
    return _dict_items(workflow_draft.get("slots"))


def _policy_items(candidate: dict[str, Any]) -> list[dict[str, Any]]:
    workflow_draft = candidate.get("workflowDraft")
    if not isinstance(workflow_draft, dict):
        return []
    return _dict_items(workflow_draft.get("policies"))


def _risk_items(candidate: dict[str, Any]) -> list[dict[str, Any]]:
    workflow_draft = candidate.get("workflowDraft")
    if not isinstance(workflow_draft, dict):
        return []
    return _dict_items(workflow_draft.get("risks"))


def _dict_items(value: object) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [cast(dict[str, Any], item) for item in value if isinstance(item, dict)]


def _caselet_intent_assignments(
    intents: list[dict[str, Any]],
    workflows: list[dict[str, Any]],
) -> dict[str, set[str]]:
    assignments: dict[str, set[str]] = {}
    for intent in intents:
        intent_code = intent.get("intentCode")
        if not isinstance(intent_code, str) or not intent_code:
            continue
        for item_id in _intent_member_ids(intent):
            assignments.setdefault(item_id, set()).add(intent_code)

    for workflow in workflows:
        intent_code = workflow.get("intentCode")
        if not isinstance(intent_code, str) or not intent_code:
            continue
        for item_id in _workflow_member_ids(workflow):
            assignments.setdefault(item_id, set()).add(intent_code)
    return assignments


def _intent_member_ids(intent: dict[str, Any]) -> set[str]:
    member_ids: set[str] = set()
    member_ids.update(_ids_from_json_field(intent.get("sourceClusterRef")))
    member_ids.update(_ids_from_json_field(intent.get("evidenceJson")))
    representative_cases = intent.get("representativeCases")
    if isinstance(representative_cases, list):
        for case in representative_cases:
            if isinstance(case, dict):
                member_ids.update(_ids_from_mapping(case))
    return member_ids


def _workflow_member_ids(workflow: dict[str, Any]) -> set[str]:
    member_ids: set[str] = set()
    member_ids.update(_ids_from_json_field(workflow.get("evidenceJson")))
    member_ids.update(_ids_from_json_field(workflow.get("metaJson")))
    return member_ids


def _ids_from_json_field(value: object) -> set[str]:
    if value is None:
        return set()
    parsed: object = value
    if isinstance(value, str):
        if not value.strip():
            return set()
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return {value.strip()}
    return _ids_from_value(parsed)


def _ids_from_value(value: object) -> set[str]:
    if isinstance(value, dict):
        return _ids_from_mapping(value)
    if isinstance(value, list):
        output: set[str] = set()
        for item in value:
            output.update(_ids_from_value(item))
        return output
    return set()


def _ids_from_mapping(value: dict[object, object]) -> set[str]:
    output: set[str] = set()
    id_keys = {
        "caseletId",
        "conversationId",
        "id",
        "sourceCaseletId",
        "sourceConversationId",
        "value",
    }
    id_list_keys = {
        "caseletIds",
        "conversationIds",
        "exemplarConversationIds",
        "memberConvIds",
        "memberConversationIds",
        "segmentIds",
    }
    item_type = value.get("type")
    for key, item in value.items():
        key_text = str(key)
        if key_text in id_keys and isinstance(item, str) and item.strip():
            if key_text != "value" or item_type in {"member_conv_id", "exemplar_conv_id", "caselet_id"}:
                output.add(item.strip())
        elif key_text in id_list_keys and isinstance(item, list):
            output.update(str(child).strip() for child in item if isinstance(child, str) and child.strip())
        elif isinstance(item, (dict, list)):
            output.update(_ids_from_value(item))
    return output
