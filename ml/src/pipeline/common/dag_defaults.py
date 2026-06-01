from __future__ import annotations

import os
from datetime import timedelta


def default_dag_args() -> dict[str, object]:
    return {
        "retries": 1,
        "retry_delay": timedelta(minutes=5),
        "execution_timeout": timedelta(minutes=_task_timeout_minutes()),
    }


def _task_timeout_minutes() -> int:
    value = os.getenv("PIPELINE_TASK_TIMEOUT_MINUTES", "90").strip()
    try:
        parsed = int(value)
    except ValueError:
        return 90
    return parsed if parsed > 0 else 90
