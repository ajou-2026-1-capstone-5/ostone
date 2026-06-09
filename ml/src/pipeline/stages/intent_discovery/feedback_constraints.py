from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, cast

from pipeline.common.exceptions import PipelineStageError

ConstraintType = Literal["must_link", "cannot_link"]
WorkflowConstraintType = Literal["same_workflow", "separate_workflow"]

# backend가 emit하는 workflow 결정 값 → 정규화된 workflow constraint type.
_WORKFLOW_TYPE_ALIASES: dict[str, WorkflowConstraintType] = {
    "same_workflow": "same_workflow",
    "separate_workflow": "separate_workflow",
    "same_intent_separate_workflow": "separate_workflow",
}


@dataclass(frozen=True)
class FeedbackConstraint:
    source_id: str
    target_id: str
    type: ConstraintType
    confidence: float = 1.0
    scope: str = "intent"
    review_task_id: str | None = None
    decision_id: str | None = None


@dataclass(frozen=True)
class WorkflowFeedbackConstraint:
    source_id: str
    target_id: str
    type: WorkflowConstraintType
    confidence: float = 1.0
    scope: str = "workflow"
    review_task_id: str | None = None
    decision_id: str | None = None


def load_feedback_constraints_from_env() -> list[FeedbackConstraint]:
    path_value = os.getenv("PIPELINE_FEEDBACK_CONSTRAINTS_PATH", "").strip()
    if not path_value:
        return []
    return load_feedback_constraints(Path(path_value))


def load_feedback_constraints(path: Path) -> list[FeedbackConstraint]:
    rows = _read_constraint_rows(path)
    constraints: list[FeedbackConstraint] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        constraint = _constraint_from_row(cast(dict[str, Any], row))
        if constraint is not None:
            constraints.append(constraint)
    return constraints


def _read_constraint_rows(path: Path) -> list[Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PipelineStageError(f"Failed to read feedback constraints: {path}") from exc
    rows = payload.get("constraints") if isinstance(payload, dict) else payload
    if not isinstance(rows, list):
        raise PipelineStageError("Feedback constraints must be a list or an object with a constraints list.")
    return rows


def _constraint_from_row(row: dict[str, Any]) -> FeedbackConstraint | None:
    source_id, target_id = _endpoint_ids(row)
    raw_type = str(row.get("type") or "").strip().lower()
    scope = str(row.get("scope") or "intent").strip().lower()
    if not source_id or not target_id or raw_type not in {"must_link", "cannot_link"} or scope != "intent":
        return None
    return FeedbackConstraint(
        source_id=source_id,
        target_id=target_id,
        type=cast(ConstraintType, raw_type),
        confidence=_bounded_float(row.get("confidence", 1.0), default=1.0),
        scope=scope,
        review_task_id=_optional_str(row.get("reviewTaskId") or row.get("review_task_id")),
        decision_id=_optional_str(row.get("decisionId") or row.get("decision_id")),
    )


def load_workflow_feedback_constraints_from_env() -> list[WorkflowFeedbackConstraint]:
    path_value = os.getenv("PIPELINE_FEEDBACK_CONSTRAINTS_PATH", "").strip()
    if not path_value:
        return []
    return load_workflow_feedback_constraints(Path(path_value))


def load_workflow_feedback_constraints(path: Path) -> list[WorkflowFeedbackConstraint]:
    rows = _read_constraint_rows(path)
    constraints: list[WorkflowFeedbackConstraint] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        constraint = _workflow_constraint_from_row(cast(dict[str, Any], row))
        if constraint is not None:
            constraints.append(constraint)
    return constraints


def _workflow_constraint_from_row(row: dict[str, Any]) -> WorkflowFeedbackConstraint | None:
    source_id, target_id = _endpoint_ids(row)
    raw_type = str(row.get("type") or row.get("decisionType") or "").strip().lower()
    scope = str(row.get("scope") or "").strip().lower()
    normalized_type = _WORKFLOW_TYPE_ALIASES.get(raw_type)
    if not source_id or not target_id or normalized_type is None or scope != "workflow":
        return None
    return WorkflowFeedbackConstraint(
        source_id=source_id,
        target_id=target_id,
        type=normalized_type,
        confidence=_bounded_float(row.get("confidence", 1.0), default=1.0),
        scope=scope,
        review_task_id=_optional_str(row.get("reviewTaskId") or row.get("review_task_id")),
        decision_id=_optional_str(row.get("decisionId") or row.get("decision_id")),
    )


def _endpoint_ids(row: dict[str, Any]) -> tuple[str, str]:
    source_id = str(
        row.get("sourceId") or row.get("source_caselet_id") or row.get("sourceCaseletId") or row.get("source_id") or ""
    ).strip()
    target_id = str(
        row.get("targetId") or row.get("target_caselet_id") or row.get("targetCaseletId") or row.get("target_id") or ""
    ).strip()
    return source_id, target_id


def _bounded_float(value: object, *, default: float) -> float:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return default
    return max(0.0, min(1.0, float(value)))


def _optional_str(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


__all__ = [
    "FeedbackConstraint",
    "WorkflowFeedbackConstraint",
    "load_feedback_constraints",
    "load_feedback_constraints_from_env",
    "load_workflow_feedback_constraints",
    "load_workflow_feedback_constraints_from_env",
]
