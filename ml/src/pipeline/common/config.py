from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from pipeline.common.exceptions import PipelineConfigurationError


@dataclass(frozen=True)
class PipelineRuntimeConfig:
    artifact_root: Path
    backend_base_url: str
    callback_enabled: bool = True
    callback_timeout_seconds: float = 10.0
    airflow_webhook_secret: str | None = None

    @classmethod
    def from_env(cls) -> "PipelineRuntimeConfig":
        artifact_root = os.getenv("PIPELINE_ARTIFACT_ROOT", "/opt/airflow/artifacts")
        backend_base_url = os.getenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
        callback_enabled = _parse_bool(os.getenv("PIPELINE_CALLBACK_ENABLED", "true"))
        callback_timeout_seconds = _parse_timeout(os.getenv("PIPELINE_CALLBACK_TIMEOUT_SECONDS", "10"))
        airflow_webhook_secret = _normalize_optional_secret(os.getenv("AIRFLOW_WEBHOOK_SECRET"))
        if not artifact_root:
            raise PipelineConfigurationError("PIPELINE_ARTIFACT_ROOT must not be blank.")
        if not backend_base_url:
            raise PipelineConfigurationError("PIPELINE_BACKEND_BASE_URL must not be blank.")
        if callback_enabled and not airflow_webhook_secret:
            raise PipelineConfigurationError("AIRFLOW_WEBHOOK_SECRET must not be blank when callbacks are enabled.")
        return cls(
            artifact_root=Path(artifact_root),
            backend_base_url=backend_base_url.rstrip("/"),
            callback_enabled=callback_enabled,
            callback_timeout_seconds=callback_timeout_seconds,
            airflow_webhook_secret=airflow_webhook_secret,
        )


def _parse_bool(value: str) -> bool:
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "y", "on"}:
        return True
    if normalized in {"0", "false", "no", "n", "off"}:
        return False
    raise PipelineConfigurationError("PIPELINE_CALLBACK_ENABLED must be a boolean value.")


def _normalize_optional_secret(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _parse_timeout(value: str) -> float:
    try:
        timeout = float(value)
    except ValueError as exc:
        raise PipelineConfigurationError("PIPELINE_CALLBACK_TIMEOUT_SECONDS must be a number.") from exc
    if timeout <= 0:
        raise PipelineConfigurationError("PIPELINE_CALLBACK_TIMEOUT_SECONDS must be greater than 0.")
    return timeout
