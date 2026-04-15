from __future__ import annotations

from datetime import timedelta

DEFAULT_DAG_ARGS = {
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(minutes=30),
}
