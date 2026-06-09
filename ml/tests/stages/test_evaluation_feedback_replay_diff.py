from __future__ import annotations

from typing import Any

from pipeline.stages.evaluation.feedback_replay_diff import build_feedback_replay_diff


def _candidate(
    intents: list[dict[str, Any]], workflows: list[dict[str, Any]], workflow_feedback: Any = None
) -> dict[str, Any]:
    return {
        "structureSnapshot": {
            "schemaVersion": "structure-snapshot.v1",
            "intents": intents,
            "workflows": workflows,
            "workflowFeedback": workflow_feedback or {"applied": [], "ignored": []},
        }
    }


def test_unavailable_when_after_snapshot_missing() -> None:
    diff = build_feedback_replay_diff({}, None, [{"sourceId": "c1", "targetId": "c2", "type": "must_link"}])
    assert diff["available"] is False
    assert diff["reason"] == "structure_snapshot_missing"


def test_unavailable_when_no_constraints() -> None:
    after = _candidate([{"intentId": "0", "intentLabel": "카드", "memberConversationIds": ["c1"]}], [])
    diff = build_feedback_replay_diff(after, None, [])
    assert diff["available"] is False
    assert diff["reason"] == "no_feedback_constraints"


def test_intent_must_link_applied_when_same_intent() -> None:
    after = _candidate(
        [{"intentId": "0", "intentLabel": "카드", "memberConversationIds": ["c1", "c2"]}],
        [],
    )
    constraints = [{"sourceId": "c1", "targetId": "c2", "type": "must_link", "scope": "intent", "reviewTaskId": "10"}]
    diff = build_feedback_replay_diff(after, None, constraints)
    assert diff["available"] is True
    decision = diff["decisions"][0]
    assert decision["status"] == "applied"
    assert decision["reviewTaskId"] == "10"
    assert diff["summary"] == {"applied": 1, "partiallyApplied": 0, "ignored": 0, "total": 1}


def test_intent_must_link_ignored_when_separated() -> None:
    after = _candidate(
        [
            {"intentId": "0", "intentLabel": "카드", "memberConversationIds": ["c1"]},
            {"intentId": "1", "intentLabel": "배송", "memberConversationIds": ["c2"]},
        ],
        [],
    )
    constraints = [{"sourceId": "c1", "targetId": "c2", "type": "must_link", "scope": "intent"}]
    diff = build_feedback_replay_diff(after, None, constraints)
    decision = diff["decisions"][0]
    assert decision["status"] == "ignored"
    assert decision["reason"] == "intent_not_merged"


def test_intent_cannot_link_applied_when_separated() -> None:
    after = _candidate(
        [
            {"intentId": "0", "intentLabel": "카드", "memberConversationIds": ["c1"]},
            {"intentId": "1", "intentLabel": "배송", "memberConversationIds": ["c2"]},
        ],
        [],
    )
    constraints = [{"sourceId": "c1", "targetId": "c2", "type": "cannot_link", "scope": "intent"}]
    diff = build_feedback_replay_diff(after, None, constraints)
    assert diff["decisions"][0]["status"] == "applied"


def test_intent_endpoint_not_in_candidate() -> None:
    after = _candidate([{"intentId": "0", "intentLabel": "카드", "memberConversationIds": ["c1"]}], [])
    constraints = [{"sourceId": "c1", "targetId": "missing", "type": "must_link", "scope": "intent"}]
    diff = build_feedback_replay_diff(after, None, constraints)
    decision = diff["decisions"][0]
    assert decision["status"] == "ignored"
    assert decision["reason"] == "endpoint_not_in_candidate"


def test_workflow_applied_from_workflow_feedback() -> None:
    after = _candidate(
        [{"intentId": "0", "intentLabel": "카드", "memberConversationIds": ["c1", "c2"]}],
        [
            {
                "workflowId": "entrypoint-0",
                "workflowLabel": "통합",
                "intentId": "0",
                "memberConversationIds": ["c1", "c2"],
            },
        ],
        workflow_feedback={
            "applied": [{"sourceId": "c1", "targetId": "c2", "type": "same_workflow", "effect": "merged"}],
            "ignored": [],
        },
    )
    constraints = [{"sourceId": "c1", "targetId": "c2", "type": "same_workflow", "scope": "workflow"}]
    diff = build_feedback_replay_diff(after, None, constraints)
    decision = diff["decisions"][0]
    assert decision["status"] == "applied"
    assert decision["effect"] == "merged"


def test_workflow_ignored_carries_reason() -> None:
    after = _candidate(
        [{"intentId": "0", "intentLabel": "카드", "memberConversationIds": ["c1"]}],
        [{"workflowId": "entrypoint-0", "workflowLabel": "통합", "intentId": "0", "memberConversationIds": ["c1"]}],
        workflow_feedback={
            "applied": [],
            "ignored": [
                {
                    "sourceId": "c1",
                    "targetId": "c9",
                    "type": "separate_workflow",
                    "reason": "endpoints_in_different_clusters",
                }
            ],
        },
    )
    constraints = [{"sourceId": "c1", "targetId": "c9", "type": "separate_workflow", "scope": "workflow"}]
    diff = build_feedback_replay_diff(after, None, constraints)
    decision = diff["decisions"][0]
    assert decision["status"] == "ignored"
    assert decision["reason"] == "endpoints_in_different_clusters"


def test_workflow_separate_partially_applied_when_intent_differs() -> None:
    after = _candidate(
        [
            {"intentId": "0", "intentLabel": "카드", "memberConversationIds": ["c1"]},
            {"intentId": "1", "intentLabel": "배송", "memberConversationIds": ["c2"]},
        ],
        [
            {"workflowId": "entrypoint-0", "workflowLabel": "a", "intentId": "0", "memberConversationIds": ["c1"]},
            {"workflowId": "entrypoint-1", "workflowLabel": "b", "intentId": "1", "memberConversationIds": ["c2"]},
        ],
        workflow_feedback={
            "applied": [{"sourceId": "c1", "targetId": "c2", "type": "separate_workflow", "effect": "split"}],
            "ignored": [],
        },
    )
    constraints = [{"sourceId": "c1", "targetId": "c2", "type": "same_intent_separate_workflow", "scope": "workflow"}]
    diff = build_feedback_replay_diff(after, None, constraints)
    decision = diff["decisions"][0]
    assert decision["status"] == "partially_applied"
    assert decision["reason"] == "workflow_separated_but_intent_differs"


def test_structure_split_merge_and_label_change() -> None:
    before = _candidate(
        [{"intentId": "0", "intentLabel": "카드", "memberConversationIds": ["c1", "c2", "c3"]}],
        [],
    )
    after = _candidate(
        [
            {"intentId": "10", "intentLabel": "카드 분실", "memberConversationIds": ["c1", "c2"]},
            {"intentId": "11", "intentLabel": "카드 결제", "memberConversationIds": ["c3"]},
        ],
        [],
    )
    constraints = [{"sourceId": "c1", "targetId": "c3", "type": "cannot_link", "scope": "intent"}]
    diff = build_feedback_replay_diff(after, before, constraints)
    assert diff["structureComparisonAvailable"] is True
    assert diff["intent"]["splitCount"] == 1
    assert diff["intent"]["mergeCount"] == 0
    labels = {change["after"] for change in diff["intent"]["labelChanges"]}
    assert "카드 분실" in labels


def test_workflow_structure_diff_groups_by_workflow_not_intent() -> None:
    # intentId는 동일하지만 workflow가 둘로 분리된 경우. workflowId 기준으로 묶여야 splitCount=1.
    before = _candidate(
        [{"intentId": "0", "intentLabel": "카드", "memberConversationIds": ["c1", "c2"]}],
        [{"workflowId": "wf-0", "workflowLabel": "통합", "intentId": "0", "memberConversationIds": ["c1", "c2"]}],
    )
    after = _candidate(
        [{"intentId": "0", "intentLabel": "카드", "memberConversationIds": ["c1", "c2"]}],
        [
            {"workflowId": "wf-1", "workflowLabel": "신고", "intentId": "0", "memberConversationIds": ["c1"]},
            {"workflowId": "wf-2", "workflowLabel": "한도", "intentId": "0", "memberConversationIds": ["c2"]},
        ],
    )
    constraints = [{"sourceId": "c1", "targetId": "c2", "type": "separate_workflow", "scope": "workflow"}]
    diff = build_feedback_replay_diff(after, before, constraints)
    assert diff["workflow"]["splitCount"] == 1
    assert diff["intent"]["splitCount"] == 0


def test_structure_comparison_unavailable_without_before() -> None:
    after = _candidate([{"intentId": "0", "intentLabel": "카드", "memberConversationIds": ["c1"]}], [])
    constraints = [{"sourceId": "c1", "targetId": "c1", "type": "must_link", "scope": "intent"}]
    diff = build_feedback_replay_diff(after, None, constraints)
    assert diff["available"] is True
    assert diff["structureComparisonAvailable"] is False
    assert diff["intent"]["splitCount"] == 0
