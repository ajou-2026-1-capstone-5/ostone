from __future__ import annotations

from datetime import timedelta

def default_dag_args() -> dict[str, object]:
    return {
        "retries": 1,
        "retry_delay": timedelta(minutes=5),
        "execution_timeout": timedelta(minutes=30),
    }
