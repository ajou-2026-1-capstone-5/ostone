from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

from pipeline.common.exceptions import PipelineStageError

from .graph_validation import _graph_nodes_and_edges, _parse_graph
from .metrics import _caselet_intent_assignments, _workflow_member_ids
from .thresholds import (
    BENCHMARK_FORBIDDEN_KEYS,
    BENCHMARK_RELATION_MAP,
    EMPTY_BENCHMARK_SUITE,
    WORKFLOW_EVENT_TERM_ALIASES,
)


def _parse_pairwise_benchmark(payload: object, path: Path | None = None) -> list[dict[str, object]]:
    return _parse_benchmark_suite(payload, path)["intentPairs"]


def _parse_benchmark_suite(payload: object, path: Path | None = None) -> dict[str, Any]:
    forbidden_path = _find_forbidden_benchmark_key(payload)
    if forbidden_path is not None:
        location = f" in {path}" if path is not None else ""
        raise PipelineStageError(
            f"Evaluation benchmark must not contain unavailable metadata{location}: {forbidden_path}"
        )
    if isinstance(payload, dict):
        rows = payload.get("pairs") or payload.get("intentPairs")
        boundary_cases = _benchmark_object_list(payload.get("boundaryCases"), "boundaryCases")
        label_expectations = _benchmark_object_list(payload.get("labelExpectations"), "labelExpectations")
        workflow_expectations = _benchmark_object_list(payload.get("workflowExpectations"), "workflowExpectations")
        if rows is None and (boundary_cases or label_expectations or workflow_expectations):
            rows = []
    else:
        rows = payload
        boundary_cases = []
        label_expectations = []
        workflow_expectations = []
    if not isinstance(rows, list):
        raise PipelineStageError("Evaluation benchmark must be a list or an object with a pairs/intentPairs list.")
    pairs: list[dict[str, object]] = []
    for index, row in enumerate(rows):
        if not isinstance(row, dict):
                raise PipelineStageError(f"Evaluation benchmark pair must be an object: index={index}")
        source_id = _benchmark_id(row, "source")
        target_id = _benchmark_id(row, "target")
        relation = _benchmark_relation(row)
        if source_id is None or target_id is None or relation is None:
                raise PipelineStageError(f"Invalid evaluation benchmark pair: index={index}")
        pairs.append(
            {
                "sourceId": source_id,
                "targetId": target_id,
                "relation": relation,
            }
        )
    return {
        "schemaVersion": "evaluation-benchmark-suite.v1",
        "intentPairs": pairs,
        "boundaryCases": [_normalize_boundary_case(row, index) for index, row in enumerate(boundary_cases)],
        "labelExpectations": [_normalize_label_expectation(row, index) for index, row in enumerate(label_expectations)],
        "workflowExpectations": [
            _normalize_workflow_expectation(row, index) for index, row in enumerate(workflow_expectations)
        ],
    }


def _benchmark_object_list(value: object, key: str) -> list[dict[str, object]]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise PipelineStageError(f"Evaluation benchmark {key} must be a list.")
    output: list[dict[str, object]] = []
    for index, item in enumerate(value):
        if not isinstance(item, dict):
                raise PipelineStageError(f"Evaluation benchmark {key}[{index}] must be an object.")
        output.append(cast(dict[str, object], item))
    return output


def _normalize_boundary_case(row: dict[str, object], index: int) -> dict[str, object]:
    conversation_id = row.get("conversationId")
    expected = row.get("expectedCaselets")
    if not isinstance(conversation_id, str) or not conversation_id.strip() or not isinstance(expected, list):
        raise PipelineStageError(f"Invalid evaluation benchmark boundary case: index={index}")
    expected_caselets: list[dict[str, object]] = []
    for case_index, caselet in enumerate(expected):
        if not isinstance(caselet, dict):
                raise PipelineStageError(
                f"Evaluation benchmark boundary caselet must be an object: index={index}.{case_index}"
            )
        turn_start = caselet.get("turnStart")
        turn_end = caselet.get("turnEnd")
        if not isinstance(turn_start, int) or isinstance(turn_start, bool):
                raise PipelineStageError(f"Invalid boundary turnStart: index={index}.{case_index}")
        if not isinstance(turn_end, int) or isinstance(turn_end, bool):
                raise PipelineStageError(f"Invalid boundary turnEnd: index={index}.{case_index}")
        expected_caselets.append(
            {
                "turnStart": turn_start,
                "turnEnd": turn_end,
                "issueObject": _optional_text(caselet.get("issueObject")),
                "issueAction": _optional_text(caselet.get("issueAction")),
            }
        )
    return {"conversationId": conversation_id.strip(), "expectedCaselets": expected_caselets}


def _normalize_label_expectation(row: dict[str, object], index: int) -> dict[str, object]:
    cluster_gold_id = row.get("clusterGoldId")
    issue_object = row.get("object")
    action = row.get("action")
    if (
        not isinstance(cluster_gold_id, str)
        or not cluster_gold_id.strip()
        or not isinstance(issue_object, str)
        or not issue_object.strip()
        or not isinstance(action, str)
        or not action.strip()
    ):
        raise PipelineStageError(f"Invalid evaluation benchmark label expectation: index={index}")
    return {
        "clusterGoldId": cluster_gold_id.strip(),
        "memberCaseletIds": _optional_str_list(row.get("memberCaseletIds")),
        "object": issue_object.strip(),
        "action": action.strip(),
        "allowedLabels": _optional_str_list(row.get("allowedLabels")),
        "forbiddenTerms": _optional_str_list(row.get("forbiddenTerms")),
    }


def _normalize_workflow_expectation(row: dict[str, object], index: int) -> dict[str, object]:
    caselet_id = row.get("caseletId")
    expected_events = row.get("expectedEvents")
    if not isinstance(caselet_id, str) or not caselet_id.strip() or not isinstance(expected_events, list):
        raise PipelineStageError(f"Invalid evaluation benchmark workflow expectation: index={index}")
    events = [item.strip() for item in expected_events if isinstance(item, str) and item.strip()]
    if not events:
        raise PipelineStageError(f"Invalid evaluation benchmark workflow expectedEvents: index={index}")
    return {
        "caseletId": caselet_id.strip(),
        "expectedEvents": events,
        "workflowVariant": _optional_text(row.get("workflowVariant")),
        "expectedBranchConditions": _optional_str_list(row.get("expectedBranchConditions")),
    }


def _optional_text(value: object) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _optional_str_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item.strip() for item in value if isinstance(item, str) and item.strip()]


def _benchmark_id(row: dict[str, object], prefix: str) -> str | None:
    keys = (
        f"{prefix}CaseletId",
        f"{prefix}_caselet_id",
        f"{prefix}ConversationId",
        f"{prefix}_conversation_id",
        f"{prefix}Id",
        f"{prefix}_id",
    )
    for key in keys:
        value = row.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _benchmark_relation(row: dict[str, object]) -> str | None:
    value = row.get("relation") or row.get("type")
    if not isinstance(value, str):
        return None
    relation = value.strip().lower()
    return BENCHMARK_RELATION_MAP.get(relation)


def _find_forbidden_benchmark_key(value: object, path: str = "$") -> str | None:
    if isinstance(value, dict):
        for key, child in value.items():
            key_text = str(key)
            child_path = f"{path}.{key_text}"
            if key_text in BENCHMARK_FORBIDDEN_KEYS:
                return child_path
            nested_path = _find_forbidden_benchmark_key(child, child_path)
            if nested_path is not None:
                return nested_path
    elif isinstance(value, list):
        for index, child in enumerate(value):
            nested_path = _find_forbidden_benchmark_key(child, f"{path}[{index}]")
            if nested_path is not None:
                return nested_path
    return None


def _coerce_benchmark_suite(benchmark: dict[str, Any] | list[dict[str, object]] | None) -> dict[str, Any] | None:
    if benchmark is None:
        return None
    if isinstance(benchmark, list):
        return {
            **EMPTY_BENCHMARK_SUITE,
            "intentPairs": benchmark,
        }
    return _parse_benchmark_suite(benchmark)


def _benchmark_suite_summary(
    intents: list[dict[str, Any]],
    workflows: list[dict[str, Any]],
    benchmark: dict[str, Any] | None,
) -> dict[str, Any]:
    suite = benchmark or EMPTY_BENCHMARK_SUITE
    pairwise = _pairwise_benchmark_summary(intents, workflows, _suite_items(suite, "intentPairs"))
    boundary = _boundary_benchmark_summary(intents, workflows, _suite_items(suite, "boundaryCases"))
    label = _label_benchmark_summary(intents, workflows, _suite_items(suite, "labelExpectations"))
    workflow = _workflow_benchmark_summary(workflows, _suite_items(suite, "workflowExpectations"))
    enabled = any(item["enabled"] is True for item in (pairwise, boundary, label, workflow))
    return {
        "enabled": enabled,
        "schemaVersion": "evaluation-benchmark-suite.v1",
        "pairwise": pairwise,
        "boundary": boundary,
        "label": label,
        "workflow": workflow,
    }


def _suite_items(suite: dict[str, Any], key: str) -> list[dict[str, object]]:
    value = suite.get(key)
    if not isinstance(value, list):
        return []
    return [cast(dict[str, object], item) for item in value if isinstance(item, dict)]


def _pairwise_benchmark_summary(
    intents: list[dict[str, Any]],
    workflows: list[dict[str, Any]],
    benchmark: list[dict[str, object]] | None,
) -> dict[str, Any]:
    if not benchmark:
        return {
            "enabled": False,
            "schemaVersion": "pairwise-benchmark.v1",
            "pairCount": 0,
            "coverage": 1.0,
            "mustLinkCount": 0,
            "mustLinkCorrectCount": 0,
            "mustLinkViolationCount": 0,
            "mustLinkUnknownCount": 0,
            "mustLinkRecall": 1.0,
            "cannotLinkCount": 0,
            "cannotLinkViolationCount": 0,
            "cannotLinkUnknownCount": 0,
            "cannotLinkViolationRate": 0.0,
        }

    assignments = _caselet_intent_assignments(intents, workflows)
    unique_ids = {
        str(pair[key])
        for pair in benchmark
        for key in ("sourceId", "targetId")
        if isinstance(pair.get(key), str) and str(pair[key]).strip()
    }
    assigned_count = sum(1 for item_id in unique_ids if assignments.get(item_id))
    must_link_count = 0
    must_link_correct = 0
    must_link_violations = 0
    must_link_unknown = 0
    cannot_link_count = 0
    cannot_link_violations = 0
    cannot_link_unknown = 0

    for pair in benchmark:
        source_id = str(pair["sourceId"])
        target_id = str(pair["targetId"])
        relation = str(pair["relation"])
        source_assignments = assignments.get(source_id, set())
        target_assignments = assignments.get(target_id, set())
        unknown = not source_assignments or not target_assignments
        same_intent = bool(source_assignments & target_assignments)
        if relation == "must_link":
            must_link_count += 1
            if unknown:
                must_link_unknown += 1
            elif same_intent:
                must_link_correct += 1
            else:
                must_link_violations += 1
        elif relation == "cannot_link":
            cannot_link_count += 1
            if unknown:
                cannot_link_unknown += 1
            elif same_intent:
                cannot_link_violations += 1

    return {
        "enabled": True,
        "schemaVersion": "pairwise-benchmark.v1",
        "pairCount": len(benchmark),
        "coverage": assigned_count / len(unique_ids) if unique_ids else 1.0,
        "mustLinkCount": must_link_count,
        "mustLinkCorrectCount": must_link_correct,
        "mustLinkViolationCount": must_link_violations,
        "mustLinkUnknownCount": must_link_unknown,
        "mustLinkRecall": must_link_correct / must_link_count if must_link_count else 1.0,
        "cannotLinkCount": cannot_link_count,
        "cannotLinkViolationCount": cannot_link_violations,
        "cannotLinkUnknownCount": cannot_link_unknown,
        "cannotLinkViolationRate": cannot_link_violations / cannot_link_count if cannot_link_count else 0.0,
    }


def _boundary_benchmark_summary(
    intents: list[dict[str, Any]],
    workflows: list[dict[str, Any]],
    boundary_cases: list[dict[str, object]],
) -> dict[str, Any]:
    if not boundary_cases:
        return {
            "enabled": False,
            "schemaVersion": "boundary-benchmark.v1",
            "caseCount": 0,
            "expectedBoundaryCount": 0,
            "matchedBoundaryCount": 0,
            "unknownConversationCount": 0,
            "boundaryPrecision": 1.0,
            "boundaryRecall": 1.0,
        }
    details = _caselet_details(intents, workflows)
    by_conversation: dict[str, set[tuple[int, int]]] = {}
    for item in details.values():
        source_id = item.get("sourceConversationId")
        turn_start = item.get("turnStart")
        turn_end = item.get("turnEnd")
        if isinstance(source_id, str) and isinstance(turn_start, int) and isinstance(turn_end, int):
            by_conversation.setdefault(source_id, set()).add((turn_start, turn_end))
    expected_count = 0
    matched_count = 0
    observed_count = 0
    unknown_count = 0
    for boundary_case in boundary_cases:
        conversation_id = boundary_case.get("conversationId")
        if not isinstance(conversation_id, str):
            continue
        expected: set[tuple[int, int]] = set()
        for item in _object_list(boundary_case.get("expectedCaselets")):
            turn_start = item.get("turnStart")
            turn_end = item.get("turnEnd")
            if isinstance(turn_start, int) and isinstance(turn_end, int):
                expected.add((turn_start, turn_end))
        observed = by_conversation.get(conversation_id, set())
        expected_count += len(expected)
        observed_count += len(observed)
        matched_count += len(expected & observed)
        if not observed:
            unknown_count += 1
    return {
        "enabled": True,
        "schemaVersion": "boundary-benchmark.v1",
        "caseCount": len(boundary_cases),
        "expectedBoundaryCount": expected_count,
        "matchedBoundaryCount": matched_count,
        "unknownConversationCount": unknown_count,
        "boundaryPrecision": matched_count / observed_count if observed_count else 0.0,
        "boundaryRecall": matched_count / expected_count if expected_count else 1.0,
    }


def _label_benchmark_summary(
    intents: list[dict[str, Any]],
    workflows: list[dict[str, Any]],
    label_expectations: list[dict[str, object]],
) -> dict[str, Any]:
    if not label_expectations:
        return {
            "enabled": False,
            "schemaVersion": "label-benchmark.v1",
            "expectationCount": 0,
            "matchedExpectationCount": 0,
            "objectAccuracy": 1.0,
            "actionAccuracy": 1.0,
            "objectActionJointAccuracy": 1.0,
            "allowedLabelAccuracy": 1.0,
            "forbiddenTermViolationRate": 0.0,
            "unknownExpectationCount": 0,
        }
    assignments = _caselet_intent_assignments(intents, workflows)
    intent_by_code = {
        str(intent["intentCode"]): intent
        for intent in intents
        if isinstance(intent.get("intentCode"), str) and str(intent["intentCode"])
    }
    matched = 0
    object_correct = 0
    action_correct = 0
    joint_correct = 0
    allowed_total = 0
    allowed_correct = 0
    forbidden_total = 0
    forbidden_violations = 0
    unknown = 0
    for expectation in label_expectations:
        intent = _label_expectation_intent(expectation, intent_by_code, assignments)
        if intent is None:
            unknown += 1
            continue
        matched += 1
        name = str(intent.get("name") or "")
        expected_object = str(expectation.get("object") or "")
        expected_action = str(expectation.get("action") or "")
        object_ok = _text_supports_term(name, expected_object)
        action_ok = _text_supports_term(name, expected_action)
        object_correct += int(object_ok)
        action_correct += int(action_ok)
        joint_correct += int(object_ok and action_ok)
        allowed_labels = _str_list(expectation.get("allowedLabels"))
        if allowed_labels:
            allowed_total += 1
            allowed_correct += int(any(_normalize_text(name) == _normalize_text(label) for label in allowed_labels))
        forbidden_terms = _str_list(expectation.get("forbiddenTerms"))
        if forbidden_terms:
            forbidden_total += 1
            forbidden_violations += int(any(_text_supports_term(name, term) for term in forbidden_terms))
    denominator = matched if matched else 0
    return {
        "enabled": True,
        "schemaVersion": "label-benchmark.v1",
        "expectationCount": len(label_expectations),
        "matchedExpectationCount": matched,
        "objectAccuracy": object_correct / denominator if denominator else 0.0,
        "actionAccuracy": action_correct / denominator if denominator else 0.0,
        "objectActionJointAccuracy": joint_correct / denominator if denominator else 0.0,
        "allowedLabelAccuracy": allowed_correct / allowed_total if allowed_total else 1.0,
        "forbiddenTermViolationRate": forbidden_violations / forbidden_total if forbidden_total else 0.0,
        "unknownExpectationCount": unknown,
    }


def _workflow_benchmark_summary(
    workflows: list[dict[str, Any]],
    workflow_expectations: list[dict[str, object]],
) -> dict[str, Any]:
    if not workflow_expectations:
        return {
            "enabled": False,
            "schemaVersion": "workflow-benchmark.v1",
            "expectationCount": 0,
            "matchedExpectationCount": 0,
            "expectedEventCount": 0,
            "matchedEventCount": 0,
            "eventRecall": 1.0,
            "branchConditionRecall": 1.0,
            "unknownExpectationCount": 0,
        }
    workflows_by_caselet: dict[str, list[dict[str, Any]]] = {}
    for workflow in workflows:
        for workflow_caselet_id in _workflow_member_ids(workflow):
            workflows_by_caselet.setdefault(workflow_caselet_id, []).append(workflow)
    matched_expectations = 0
    unknown = 0
    expected_event_count = 0
    matched_event_count = 0
    expected_branch_count = 0
    matched_branch_count = 0
    for expectation in workflow_expectations:
        expected_caselet_id = expectation.get("caseletId")
        if not isinstance(expected_caselet_id, str):
            continue
        matched_workflows = workflows_by_caselet.get(expected_caselet_id, [])
        if not matched_workflows:
            unknown += 1
            expected_event_count += len(_str_list(expectation.get("expectedEvents")))
            expected_branch_count += len(_str_list(expectation.get("expectedBranchConditions")))
            continue
        matched_expectations += 1
        expected_events = _str_list(expectation.get("expectedEvents"))
        expected_event_count += len(expected_events)
        workflow_terms = set().union(*(_workflow_supported_terms(workflow) for workflow in matched_workflows))
        matched_event_count += sum(1 for event in expected_events if _term_supported_by_terms(event, workflow_terms))
        branch_conditions = _str_list(expectation.get("expectedBranchConditions"))
        expected_branch_count += len(branch_conditions)
        matched_branch_count += sum(
            1 for condition in branch_conditions if _term_supported_by_terms(condition, workflow_terms)
        )
    return {
        "enabled": True,
        "schemaVersion": "workflow-benchmark.v1",
        "expectationCount": len(workflow_expectations),
        "matchedExpectationCount": matched_expectations,
        "expectedEventCount": expected_event_count,
        "matchedEventCount": matched_event_count,
        "eventRecall": matched_event_count / expected_event_count if expected_event_count else 1.0,
        "branchConditionRecall": matched_branch_count / expected_branch_count if expected_branch_count else 1.0,
        "unknownExpectationCount": unknown,
    }


def _caselet_details(
    intents: list[dict[str, Any]],
    workflows: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    details: dict[str, dict[str, Any]] = {}
    for intent in intents:
        for item in _caselet_details_from_json_field(intent.get("sourceClusterRef")):
            _merge_caselet_detail(details, item)
        for item in _caselet_details_from_json_field(intent.get("evidenceJson")):
            _merge_caselet_detail(details, item)
        representative_cases = intent.get("representativeCases")
        if isinstance(representative_cases, list):
            for item in representative_cases:
                if isinstance(item, dict):
                    _merge_caselet_detail(details, cast(dict[str, Any], item))
    for workflow in workflows:
        for item in _caselet_details_from_json_field(workflow.get("evidenceJson")):
            _merge_caselet_detail(details, item)
        for item in _caselet_details_from_json_field(workflow.get("metaJson")):
            _merge_caselet_detail(details, item)
    return details


def _merge_caselet_detail(details: dict[str, dict[str, Any]], item: dict[str, Any]) -> None:
    caselet_id = _caselet_detail_id(item)
    if caselet_id is None:
        return
    current = details.setdefault(caselet_id, {"caseletId": caselet_id})
    for key in (
        "sourceConversationId",
        "conversationId",
        "turnStart",
        "turnEnd",
        "flowEvents",
        "actionObjectFrame",
        "evidenceTurnIds",
    ):
        if key in item and item[key] not in (None, "", [], {}):
            current[key] = item[key]


def _caselet_detail_id(item: dict[str, Any]) -> str | None:
    for key in ("caseletId", "conversationId", "id", "sourceCaseletId", "sourceConversationId"):
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    item_type = item.get("type")
    value = item.get("value")
    if item_type in {"member_conv_id", "exemplar_conv_id", "caselet_id"} and isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _caselet_details_from_json_field(value: object) -> list[dict[str, Any]]:
    if value is None:
        return []
    parsed: object = value
    if isinstance(value, str):
        if not value.strip():
            return []
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return [{"caseletId": value.strip()}]
    return _caselet_details_from_value(parsed)


def _caselet_details_from_value(value: object) -> list[dict[str, Any]]:
    if isinstance(value, dict):
        output: list[dict[str, Any]] = []
        if _caselet_detail_id(cast(dict[str, Any], value)) is not None:
            output.append(cast(dict[str, Any], value))
        for key in ("segments", "caselets", "representativeCases"):
            output.extend(_caselet_details_from_value(value.get(key)))
        return output
    if isinstance(value, list):
        list_output: list[dict[str, Any]] = []
        for item in value:
            list_output.extend(_caselet_details_from_value(item))
        return list_output
    return []


def _label_expectation_intent(
    expectation: dict[str, object],
    intent_by_code: dict[str, dict[str, Any]],
    assignments: dict[str, set[str]],
) -> dict[str, Any] | None:
    member_ids = _str_list(expectation.get("memberCaseletIds"))
    candidate_codes: set[str] = set()
    for member_id in member_ids:
        candidate_codes.update(assignments.get(member_id, set()))
    if candidate_codes:
        for code in sorted(candidate_codes):
            if code in intent_by_code:
                return intent_by_code[code]
    cluster_gold_id = expectation.get("clusterGoldId")
    if isinstance(cluster_gold_id, str):
        direct = intent_by_code.get(cluster_gold_id)
        if direct is not None:
            return direct
    return None


def _workflow_supported_terms(workflow: dict[str, Any]) -> set[str]:
    terms: set[str] = set()
    graph = _parse_graph(workflow.get("graphJson"))
    if graph is not None:
        nodes, edges = _graph_nodes_and_edges(graph)
        for item in (nodes or []) + (edges or []):
            if isinstance(item, dict):
                _collect_supported_terms(item, terms)
    for field in ("evidenceJson", "metaJson", "routeConditionJson"):
        _collect_supported_terms_from_json(workflow.get(field), terms)
    return {_normalize_text(term) for term in terms if _normalize_text(term)}


def _collect_supported_terms_from_json(value: object, output: set[str]) -> None:
    if value is None:
        return
    parsed: object = value
    if isinstance(value, str):
        if not value.strip():
            return
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            output.add(value)
            return
    _collect_supported_terms(parsed, output)


def _collect_supported_terms(value: object, output: set[str]) -> None:
    if isinstance(value, dict):
        for key, item in value.items():
            if key in {"label", "value", "action", "workflowVariant"} and isinstance(item, str):
                output.add(item)
            elif key in {"requiredTerms", "optionalTerms", "negativeTerms", "flowEvents", "expectedEvents"}:
                output.update(_str_list(item))
            elif key == "evidenceRefs" and isinstance(item, list):
                _collect_supported_terms(item, output)
            elif isinstance(item, (dict, list)):
                _collect_supported_terms(item, output)
    elif isinstance(value, list):
        for item in value:
            _collect_supported_terms(item, output)


def _term_supported_by_terms(term: str, supported_terms: set[str]) -> bool:
    normalized = _normalize_text(term)
    aliases = tuple(_normalize_text(alias) for alias in WORKFLOW_EVENT_TERM_ALIASES.get(term, ()))
    return any(
        normalized == candidate
        or normalized in candidate
        or candidate in normalized
        or any(alias and (alias == candidate or alias in candidate or candidate in alias) for alias in aliases)
        for candidate in supported_terms
    )


def _text_supports_term(text: str, term: str) -> bool:
    normalized_text = _normalize_text(text)
    normalized_term = _normalize_text(term)
    return bool(normalized_term) and normalized_term in normalized_text


def _normalize_text(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return "".join(value.casefold().split())


def _object_list(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        return []
    return [cast(dict[str, object], item) for item in value if isinstance(item, dict)]


def _str_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item.strip() for item in value if isinstance(item, str) and item.strip()]
