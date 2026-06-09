from __future__ import annotations

import json
from pathlib import Path

from pipeline.stages.intent_discovery.feedback_constraints import (
    load_feedback_constraints,
    load_workflow_feedback_constraints,
)


def _write(path: Path, constraints: list[dict[str, object]]) -> Path:
    path.write_text(json.dumps({"constraints": constraints}), encoding="utf-8")
    return path


def test_load_feedback_constraints_accepts_review_schema(tmp_path: Path) -> None:
    path = tmp_path / "constraints.json"
    path.write_text(
        json.dumps(
            {
                "constraints": [
                    {
                        "sourceId": "case-1",
                        "targetId": "case-2",
                        "type": "must_link",
                        "scope": "intent",
                        "reviewTaskId": 17,
                        "decisionId": 31,
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    constraints = load_feedback_constraints(path)

    assert len(constraints) == 1
    assert constraints[0].source_id == "case-1"
    assert constraints[0].target_id == "case-2"
    assert constraints[0].scope == "intent"
    assert constraints[0].review_task_id == "17"
    assert constraints[0].decision_id == "31"


def test_load_feedback_constraints_ignores_non_intent_scope(tmp_path: Path) -> None:
    path = tmp_path / "constraints.json"
    path.write_text(
        json.dumps(
            {
                "constraints": [
                    {
                        "sourceId": "case-1",
                        "targetId": "case-2",
                        "type": "cannot_link",
                        "scope": "workflow_entrypoint",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    assert load_feedback_constraints(path) == []


def test_intent_loader_ignores_workflow_scope(tmp_path: Path) -> None:
    path = _write(
        tmp_path / "constraints.json",
        [{"sourceId": "c1", "targetId": "c2", "type": "same_workflow", "scope": "workflow"}],
    )

    assert load_feedback_constraints(path) == []


def test_workflow_loader_parses_workflow_scope_only(tmp_path: Path) -> None:
    path = _write(
        tmp_path / "constraints.json",
        [
            {"sourceId": "c1", "targetId": "c2", "type": "same_workflow", "scope": "workflow"},
            {
                "sourceId": "c3",
                "targetId": "c4",
                "type": "same_intent_separate_workflow",
                "scope": "workflow",
                "reviewTaskId": 9,
                "decisionId": 12,
            },
            {"sourceId": "c5", "targetId": "c6", "type": "must_link", "scope": "intent"},
            {"sourceId": "c7", "targetId": "c8", "type": "different_intent", "scope": "intent"},
        ],
    )

    constraints = load_workflow_feedback_constraints(path)

    assert [(c.source_id, c.target_id, c.type) for c in constraints] == [
        ("c1", "c2", "same_workflow"),
        ("c3", "c4", "separate_workflow"),
    ]
    assert constraints[1].review_task_id == "9"
    assert constraints[1].decision_id == "12"


def test_workflow_loader_ignores_unknown_type(tmp_path: Path) -> None:
    path = _write(
        tmp_path / "constraints.json",
        [{"sourceId": "c1", "targetId": "c2", "type": "cannot_link", "scope": "workflow"}],
    )

    assert load_workflow_feedback_constraints(path) == []
