from __future__ import annotations

import json
from pathlib import Path

from pipeline.stages.intent_discovery.feedback_constraints import load_feedback_constraints


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
