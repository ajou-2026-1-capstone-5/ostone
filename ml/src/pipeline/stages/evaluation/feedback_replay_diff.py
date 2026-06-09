"""feedback replay 전후 intent/workflow 구조 diff와 decision별 적용 상태를 계산한다.

backend는 intent/flow 중간 산출물을 직접 보지 못하므로, replay run의 evaluation 단계에서
before(source) candidate와 after candidate의 ``structureSnapshot``을 비교해 diff를 만들고
candidate에 첨부한다. 이후 domain-pack 콜백으로 backend에 전달된다.

structureSnapshot은 draft_generation이 임베드하며 다음 형태다::

    {
      "intents":   [{"intentId", "intentLabel", "memberConversationIds": [...]}],
      "workflows": [{"workflowId", "workflowLabel", "intentId", "memberConversationIds": [...]}],
      "workflowFeedback": {"applied": [...], "ignored": [...]}
    }
"""

from __future__ import annotations

from typing import Any

SCHEMA_VERSION = "feedback-replay-diff.v1"

# intent membership으로 판정하는 status reason
REASON_ENDPOINT_NOT_IN_CANDIDATE = "endpoint_not_in_candidate"
REASON_INTENT_NOT_MERGED = "intent_not_merged"
REASON_INTENT_NOT_SEPARATED = "intent_not_separated"
REASON_WORKFLOW_SEPARATED_BUT_INTENT_DIFFERS = "workflow_separated_but_intent_differs"
REASON_NOT_EVALUATED = "not_evaluated"

# decision status
STATUS_APPLIED = "applied"
STATUS_PARTIALLY_APPLIED = "partially_applied"
STATUS_IGNORED = "ignored"

# workflow constraint type 정규화 (backend가 emit하는 별칭 포함)
_WORKFLOW_TYPE_ALIASES = {
    "same_workflow": "same_workflow",
    "separate_workflow": "separate_workflow",
    "same_intent_separate_workflow": "separate_workflow",
}


def build_feedback_replay_diff(
    after_candidate: dict[str, Any],
    before_candidate: dict[str, Any] | None,
    constraints: list[dict[str, Any]],
) -> dict[str, Any]:
    """before/after candidate와 feedback constraints로 replay diff를 만든다."""
    after_snapshot = _snapshot(after_candidate)
    if after_snapshot is None:
        return _unavailable("structure_snapshot_missing")
    if not constraints:
        return _unavailable("no_feedback_constraints")

    # before snapshot이 없으면(이전 run이 구버전이거나 못 찾음) split/merge·label 비교만 생략하고
    # decision별 적용 상태는 after membership으로 계속 계산한다(available=true 유지).
    before_snapshot = _snapshot(before_candidate)
    structure_available = before_snapshot is not None

    after_intent_of = _conversation_to_group(after_snapshot.get("intents"))
    applied_index, ignored_index = _index_workflow_feedback(after_snapshot.get("workflowFeedback"))

    decisions: list[dict[str, Any]] = []
    for raw in constraints:
        decision = _decision_status(
            raw,
            after_intent_of=after_intent_of,
            applied_index=applied_index,
            ignored_index=ignored_index,
        )
        if decision is not None:
            decisions.append(decision)

    intent_diff = (
        _structure_diff(before_snapshot.get("intents"), after_snapshot.get("intents"))
        if structure_available
        else _empty_structure()
    )
    workflow_diff = (
        _structure_diff(before_snapshot.get("workflows"), after_snapshot.get("workflows"))
        if structure_available
        else _empty_structure()
    )

    return {
        "schemaVersion": SCHEMA_VERSION,
        "available": True,
        "reason": None,
        "structureComparisonAvailable": structure_available,
        "intent": intent_diff,
        "workflow": workflow_diff,
        "decisions": decisions,
        "summary": _summarize(decisions),
    }


def _unavailable(reason: str) -> dict[str, Any]:
    return {
        "schemaVersion": SCHEMA_VERSION,
        "available": False,
        "reason": reason,
        "structureComparisonAvailable": False,
        "intent": _empty_structure(),
        "workflow": _empty_structure(),
        "decisions": [],
        "summary": {"applied": 0, "partiallyApplied": 0, "ignored": 0, "total": 0},
    }


def _empty_structure() -> dict[str, Any]:
    return {"splitCount": 0, "mergeCount": 0, "labelChanges": []}


def _snapshot(candidate: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(candidate, dict):
        return None
    snapshot = candidate.get("structureSnapshot")
    return snapshot if isinstance(snapshot, dict) else None


def _conversation_to_group(groups: object) -> dict[str, str]:
    """conversation id -> 소속 group id. 한 conversation이 여러 group이면 첫 매칭을 유지한다."""
    mapping: dict[str, str] = {}
    if not isinstance(groups, list):
        return mapping
    for group in groups:
        if not isinstance(group, dict):
            continue
        group_id = _group_id(group)
        if group_id is None:
            continue
        for member in _string_list(group.get("memberConversationIds")):
            mapping.setdefault(member, group_id)
    return mapping


def _group_id(group: dict[str, Any]) -> str | None:
    # workflow 항목은 workflowId·intentId를 모두 가지므로 workflowId를 우선해 workflow 비교가
    # intentId로 잘못 묶이지 않게 한다. intent 항목은 workflowId가 없어 intentId로 떨어진다.
    value = group.get("workflowId")
    if value is None:
        value = group.get("intentId")
    text = "" if value is None else str(value).strip()
    return text or None


def _index_workflow_feedback(
    workflow_feedback: object,
) -> tuple[dict[tuple[str, str, str], dict[str, Any]], dict[tuple[str, str, str], dict[str, Any]]]:
    applied: dict[tuple[str, str, str], dict[str, Any]] = {}
    ignored: dict[tuple[str, str, str], dict[str, Any]] = {}
    if not isinstance(workflow_feedback, dict):
        return applied, ignored
    for row in workflow_feedback.get("applied") or []:
        key = _workflow_feedback_key(row)
        if key is not None:
            applied[key] = row if isinstance(row, dict) else {}
    for row in workflow_feedback.get("ignored") or []:
        key = _workflow_feedback_key(row)
        if key is not None:
            ignored[key] = row if isinstance(row, dict) else {}
    return applied, ignored


def _workflow_feedback_key(row: object) -> tuple[str, str, str] | None:
    if not isinstance(row, dict):
        return None
    source_id, target_id = _endpoint_ids(row)
    constraint_type = _normalize_workflow_type(row.get("type"))
    if not source_id or not target_id or constraint_type is None:
        return None
    return _ordered(source_id, target_id) + (constraint_type,)


def _decision_status(
    raw: dict[str, Any],
    *,
    after_intent_of: dict[str, str],
    applied_index: dict[tuple[str, str, str], dict[str, Any]],
    ignored_index: dict[tuple[str, str, str], dict[str, Any]],
) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    source_id, target_id = _endpoint_ids(raw)
    if not source_id or not target_id:
        return None
    scope = str(raw.get("scope") or "intent").strip().lower()
    base = {
        "reviewTaskId": _optional_str(raw.get("reviewTaskId") or raw.get("review_task_id")),
        "decisionId": _optional_str(raw.get("decisionId") or raw.get("decision_id")),
        "sourceId": source_id,
        "targetId": target_id,
        "scope": scope,
    }
    if scope == "workflow":
        return {**base, **_workflow_decision(raw, source_id, target_id, after_intent_of, applied_index, ignored_index)}
    return {**base, **_intent_decision(raw, source_id, target_id, after_intent_of)}


def _intent_decision(
    raw: dict[str, Any],
    source_id: str,
    target_id: str,
    after_intent_of: dict[str, str],
) -> dict[str, Any]:
    constraint_type = str(raw.get("type") or "").strip().lower()
    result = {"type": constraint_type, "effect": None, "reason": None, "status": STATUS_IGNORED}
    source_intent = after_intent_of.get(source_id)
    target_intent = after_intent_of.get(target_id)
    if source_intent is None or target_intent is None:
        result["reason"] = REASON_ENDPOINT_NOT_IN_CANDIDATE
        return result
    same_intent = source_intent == target_intent
    if constraint_type == "must_link":
        if same_intent:
            result["status"] = STATUS_APPLIED
        else:
            result["reason"] = REASON_INTENT_NOT_MERGED
    elif constraint_type == "cannot_link":
        if not same_intent:
            result["status"] = STATUS_APPLIED
        else:
            result["reason"] = REASON_INTENT_NOT_SEPARATED
    else:
        result["reason"] = REASON_NOT_EVALUATED
    return result


def _workflow_decision(
    raw: dict[str, Any],
    source_id: str,
    target_id: str,
    after_intent_of: dict[str, str],
    applied_index: dict[tuple[str, str, str], dict[str, Any]],
    ignored_index: dict[tuple[str, str, str], dict[str, Any]],
) -> dict[str, Any]:
    constraint_type = _normalize_workflow_type(raw.get("type"))
    result = {
        "type": constraint_type or str(raw.get("type") or "").strip().lower(),
        "effect": None,
        "reason": None,
        "status": STATUS_IGNORED,
    }
    if constraint_type is None:
        result["reason"] = REASON_NOT_EVALUATED
        return result
    key = _ordered(source_id, target_id) + (constraint_type,)
    if key in ignored_index:
        result["reason"] = _optional_str(ignored_index[key].get("reason")) or REASON_NOT_EVALUATED
        return result
    if key not in applied_index:
        result["reason"] = REASON_NOT_EVALUATED
        return result
    result["effect"] = _optional_str(applied_index[key].get("effect"))
    result["status"] = STATUS_APPLIED
    # same_intent_separate_workflow 의도: workflow는 분리됐으나 intent가 갈라지면 부분 적용.
    if constraint_type == "separate_workflow":
        source_intent = after_intent_of.get(source_id)
        target_intent = after_intent_of.get(target_id)
        if source_intent is not None and target_intent is not None and source_intent != target_intent:
            result["status"] = STATUS_PARTIALLY_APPLIED
            result["reason"] = REASON_WORKFLOW_SEPARATED_BUT_INTENT_DIFFERS
    return result


def _structure_diff(before_groups: object, after_groups: object) -> dict[str, Any]:
    before = _group_members(before_groups)
    after = _group_members(after_groups)
    return {
        "splitCount": _split_count(before, after),
        "mergeCount": _split_count(after, before),
        "labelChanges": _label_changes(before_groups, after_groups, before, after),
    }


def _split_count(source: dict[str, set[str]], target: dict[str, set[str]]) -> int:
    """source 한 group의 member가 target 2개 이상 group으로 흩어진 group 수."""
    member_to_target = {member: group_id for group_id, members in target.items() for member in members}
    count = 0
    for members in source.values():
        landed = {member_to_target[member] for member in members if member in member_to_target}
        if len(landed) >= 2:
            count += 1
    return count


def _label_changes(
    before_groups: object,
    after_groups: object,
    before_members: dict[str, set[str]],
    after_members: dict[str, set[str]],
) -> list[dict[str, Any]]:
    before_labels = _group_labels(before_groups)
    after_labels = _group_labels(after_groups)
    changes: list[dict[str, Any]] = []
    for before_id, after_id in _match_by_overlap(before_members, after_members):
        before_label = before_labels.get(before_id, "")
        after_label = after_labels.get(after_id, "")
        if before_label and after_label and before_label != after_label:
            changes.append({"id": after_id, "before": before_label, "after": after_label})
    return changes


def _match_by_overlap(before_members: dict[str, set[str]], after_members: dict[str, set[str]]) -> list[tuple[str, str]]:
    """membership 교집합이 가장 큰 before↔after group을 1:1 그리디 매칭한다."""
    pairs: list[tuple[int, str, str]] = []
    for before_id, members in before_members.items():
        for after_id, after_set in after_members.items():
            overlap = len(members & after_set)
            if overlap > 0:
                pairs.append((overlap, before_id, after_id))
    pairs.sort(key=lambda item: item[0], reverse=True)
    used_before: set[str] = set()
    used_after: set[str] = set()
    matched: list[tuple[str, str]] = []
    for _, before_id, after_id in pairs:
        if before_id in used_before or after_id in used_after:
            continue
        used_before.add(before_id)
        used_after.add(after_id)
        matched.append((before_id, after_id))
    return matched


def _group_members(groups: object) -> dict[str, set[str]]:
    result: dict[str, set[str]] = {}
    if not isinstance(groups, list):
        return result
    for group in groups:
        if not isinstance(group, dict):
            continue
        group_id = _group_id(group)
        if group_id is None:
            continue
        result.setdefault(group_id, set()).update(_string_list(group.get("memberConversationIds")))
    return result


def _group_labels(groups: object) -> dict[str, str]:
    result: dict[str, str] = {}
    if not isinstance(groups, list):
        return result
    for group in groups:
        if not isinstance(group, dict):
            continue
        group_id = _group_id(group)
        if group_id is None:
            continue
        label = group.get("intentLabel") if "intentLabel" in group else group.get("workflowLabel")
        result.setdefault(group_id, str(label).strip() if label is not None else "")
    return result


def _summarize(decisions: list[dict[str, Any]]) -> dict[str, int]:
    applied = sum(1 for item in decisions if item.get("status") == STATUS_APPLIED)
    partial = sum(1 for item in decisions if item.get("status") == STATUS_PARTIALLY_APPLIED)
    ignored = sum(1 for item in decisions if item.get("status") == STATUS_IGNORED)
    return {"applied": applied, "partiallyApplied": partial, "ignored": ignored, "total": len(decisions)}


def _normalize_workflow_type(value: object) -> str | None:
    return _WORKFLOW_TYPE_ALIASES.get(str(value or "").strip().lower())


def _endpoint_ids(row: dict[str, Any]) -> tuple[str, str]:
    source_id = str(row.get("sourceId") or row.get("source_id") or "").strip()
    target_id = str(row.get("targetId") or row.get("target_id") or "").strip()
    return source_id, target_id


def _ordered(left: str, right: str) -> tuple[str, str]:
    return (left, right) if left <= right else (right, left)


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for raw in value if (item := str(raw).strip())]


def _optional_str(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


__all__ = ["build_feedback_replay_diff", "SCHEMA_VERSION"]
