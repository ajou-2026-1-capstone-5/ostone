from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import datetime, timezone

from pipeline.common.airflow_context import context_value
from pipeline.common.callbacks import post_callback
from pipeline.common.config import PipelineRuntimeConfig

logger = logging.getLogger(__name__)

CALLBACK_FAILURE = "failures"


def notify_failure_callback(context: Mapping[str, object]) -> None:
    try:
        runtime_config = PipelineRuntimeConfig.from_env()
        if not runtime_config.callback_enabled:
            return
        pipeline_job_id = context_value(context, "pipeline_job_id")
        if not pipeline_job_id:
            logger.warning("Skip failure callback because pipeline_job_id is missing.")
            return
        post_callback(
            runtime_config.backend_base_url,
            pipeline_job_id,
            CALLBACK_FAILURE,
            build_failure_callback_payload(context),
            runtime_config.airflow_webhook_secret or "",
            runtime_config.callback_timeout_seconds,
        )
    except Exception:
        logger.exception("Failed to send pipeline failure callback.")


def build_failure_callback_payload(
    context: Mapping[str, object],
    *,
    occurred_at: datetime | None = None,
) -> dict[str, object]:
    dag_id = _dag_id_from_context(context)
    dag_run_id = _dag_run_id_from_context(context)
    failed_stage = _failed_stage_from_context(context)
    exception = context.get("exception")
    reason = type(exception).__name__ if exception is not None else "TaskFailed"
    message = str(exception).strip() if exception is not None else "Airflow task failed."
    occurred_at = occurred_at or datetime.now(timezone.utc)
    return {
        "externalEventId": failure_external_event_id(dag_id, dag_run_id, failed_stage),
        "dagId": dag_id,
        "dagRunId": dag_run_id,
        "failedStage": failed_stage,
        "reason": reason[:100] or "TaskFailed",
        "message": message[:5000] or "Airflow task failed.",
        "occurredAt": occurred_at.isoformat(),
        "error": {
            "type": reason,
            "message": message,
        },
    }


def failure_external_event_id(dag_id: str, dag_run_id: str, failed_stage: str) -> str:
    value = f"{dag_id}:{dag_run_id}:{failed_stage}:{CALLBACK_FAILURE}"
    if len(value) <= 255:
        return value
    return f"{dag_id[:48]}:{dag_run_id[:120]}:{failed_stage[:48]}:{CALLBACK_FAILURE}"


def _dag_id_from_context(context: Mapping[str, object]) -> str:
    dag = context.get("dag")
    return str(getattr(dag, "dag_id", "") or context_value(context, "dag_id") or "")


def _dag_run_id_from_context(context: Mapping[str, object]) -> str:
    dag_run = context.get("dag_run")
    return str(getattr(dag_run, "run_id", "") or context.get("run_id") or "")


def _failed_stage_from_context(context: Mapping[str, object]) -> str:
    task_instance = context.get("task_instance")
    return str(getattr(task_instance, "task_id", "") or "unknown")
