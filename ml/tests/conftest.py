from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _default_pipeline_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AIRFLOW_WEBHOOK_SECRET", "test-secret")
