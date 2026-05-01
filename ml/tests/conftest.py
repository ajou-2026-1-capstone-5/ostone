from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _default_pipeline_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AIRFLOW_WEBHOOK_SECRET", "test-secret")
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
