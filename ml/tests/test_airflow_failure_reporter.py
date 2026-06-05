from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pipeline.airflow_failure_reporter import build_failure_callback_payload, failure_external_event_id


def test_failure_callback_payload_matches_contract() -> None:
    occurred_at = datetime(2026, 6, 5, 12, 30, tzinfo=timezone.utc)
    context = {
        "dag": type("Dag", (), {"dag_id": "domain_pack_generation"})(),
        "dag_run": type("DagRun", (), {"run_id": "manual__2026-06-05"})(),
        "task_instance": type("TaskInstance", (), {"task_id": "draft_generation"})(),
        "exception": ValueError("invalid draft payload"),
    }

    assert build_failure_callback_payload(context, occurred_at=occurred_at) == {
        "externalEventId": "domain_pack_generation:manual__2026-06-05:draft_generation:failures",
        "dagId": "domain_pack_generation",
        "dagRunId": "manual__2026-06-05",
        "failedStage": "draft_generation",
        "reason": "ValueError",
        "message": "invalid draft payload",
        "occurredAt": "2026-06-05T12:30:00+00:00",
        "error": {
            "type": "ValueError",
            "message": "invalid draft payload",
        },
    }


def test_failure_callback_payload_uses_task_failed_defaults() -> None:
    payload = build_failure_callback_payload({}, occurred_at=datetime(2026, 6, 5, tzinfo=timezone.utc))

    assert payload["failedStage"] == "unknown"
    assert payload["reason"] == "TaskFailed"
    assert payload["message"] == "Airflow task failed."
    assert payload["error"] == {"type": "TaskFailed", "message": "Airflow task failed."}


def test_failure_external_event_id_is_bounded() -> None:
    external_event_id = failure_external_event_id("d" * 120, "r" * 220, "s" * 120)

    assert len(external_event_id) <= 255
    assert external_event_id.endswith(":failures")


def test_failure_callback_payload_falls_back_to_context_run_id_and_params() -> None:
    context: dict[str, Any] = {
        "run_id": "manual__fallback",
        "params": {"dag_id": "domain_pack_generation"},
    }

    payload = build_failure_callback_payload(context, occurred_at=datetime(2026, 6, 5, tzinfo=timezone.utc))

    assert payload["dagId"] == "domain_pack_generation"
    assert payload["dagRunId"] == "manual__fallback"
