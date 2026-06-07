from __future__ import annotations

import logging
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

import boto3

from pipeline.common.exceptions import PipelineConfigurationError, PipelineStageError

logger = logging.getLogger(__name__)

DEFAULT_DESIRED_COUNT = 1
DEFAULT_POLL_INTERVAL_SECONDS = 15.0
DEFAULT_START_TIMEOUT_SECONDS = 1200.0
DEFAULT_STOP_TIMEOUT_SECONDS = 600.0
DEFAULT_HEALTH_REQUEST_TIMEOUT_SECONDS = 5.0


@dataclass(frozen=True)
class LlmServiceLifecycleConfig:
    cluster: str
    service: str
    desired_count: int
    poll_interval_seconds: float
    start_timeout_seconds: float
    stop_timeout_seconds: float
    health_url: str | None
    health_request_timeout_seconds: float


def start_llm_service() -> dict[str, object]:
    config = _config_from_env()
    if config is None:
        return {"enabled": False, "reason": "missing_pipeline_llm_ecs_service"}

    ecs = boto3.client("ecs")
    logger.info(
        "Starting LLM ECS service cluster=%s service=%s desired_count=%s",
        config.cluster,
        config.service,
        config.desired_count,
    )
    ecs.update_service(cluster=config.cluster, service=config.service, desiredCount=config.desired_count)
    _wait_for_service_count(
        ecs, config, desired_count=config.desired_count, timeout_seconds=config.start_timeout_seconds
    )
    if config.health_url:
        _wait_for_health(config)
    return {
        "enabled": True,
        "cluster": config.cluster,
        "service": config.service,
        "desiredCount": config.desired_count,
        "healthUrl": config.health_url,
    }


def stop_llm_service() -> dict[str, object]:
    config = _config_from_env()
    if config is None:
        return {"enabled": False, "reason": "missing_pipeline_llm_ecs_service"}

    ecs = boto3.client("ecs")
    logger.info("Stopping LLM ECS service cluster=%s service=%s", config.cluster, config.service)
    ecs.update_service(cluster=config.cluster, service=config.service, desiredCount=0)
    _wait_for_service_count(ecs, config, desired_count=0, timeout_seconds=config.stop_timeout_seconds)
    return {"enabled": True, "cluster": config.cluster, "service": config.service, "desiredCount": 0}


def _config_from_env() -> LlmServiceLifecycleConfig | None:
    enabled_override = _optional_env("PIPELINE_LLM_SERVICE_LIFECYCLE_ENABLED")
    service = _optional_env("PIPELINE_LLM_ECS_SERVICE")
    cluster = _optional_env("PIPELINE_LLM_ECS_CLUSTER") or _optional_env("PIPELINE_ECS_CLUSTER")
    default_enabled = bool(service)
    enabled = _bool_env("PIPELINE_LLM_SERVICE_LIFECYCLE_ENABLED", default=default_enabled)
    if not enabled:
        return None
    if not service:
        if enabled_override is not None:
            raise PipelineConfigurationError("PIPELINE_LLM_ECS_SERVICE is required when LLM lifecycle is enabled.")
        return None
    if not cluster:
        raise PipelineConfigurationError("PIPELINE_LLM_ECS_CLUSTER or PIPELINE_ECS_CLUSTER is required.")

    return LlmServiceLifecycleConfig(
        cluster=cluster,
        service=service,
        desired_count=_positive_int_env("PIPELINE_LLM_ECS_DESIRED_COUNT", DEFAULT_DESIRED_COUNT),
        poll_interval_seconds=_positive_float_env(
            "PIPELINE_LLM_SERVICE_POLL_INTERVAL_SECONDS",
            DEFAULT_POLL_INTERVAL_SECONDS,
        ),
        start_timeout_seconds=_positive_float_env(
            "PIPELINE_LLM_SERVICE_START_TIMEOUT_SECONDS",
            DEFAULT_START_TIMEOUT_SECONDS,
        ),
        stop_timeout_seconds=_positive_float_env(
            "PIPELINE_LLM_SERVICE_STOP_TIMEOUT_SECONDS",
            DEFAULT_STOP_TIMEOUT_SECONDS,
        ),
        health_url=_optional_env("PIPELINE_LLM_HEALTH_URL") or _health_url_from_runtime_base_url(),
        health_request_timeout_seconds=_positive_float_env(
            "PIPELINE_LLM_HEALTH_REQUEST_TIMEOUT_SECONDS",
            DEFAULT_HEALTH_REQUEST_TIMEOUT_SECONDS,
        ),
    )


def _wait_for_service_count(
    ecs: Any,
    config: LlmServiceLifecycleConfig,
    *,
    desired_count: int,
    timeout_seconds: float,
) -> None:
    deadline = time.monotonic() + timeout_seconds
    while True:
        service = _describe_service(ecs, config)
        running_count = int(service.get("runningCount") or 0)
        pending_count = int(service.get("pendingCount") or 0)
        if desired_count == 0:
            if running_count == 0 and pending_count == 0:
                return
        elif running_count >= desired_count:
            return

        if time.monotonic() >= deadline:
            raise PipelineStageError(
                "Timed out waiting for LLM ECS service "
                f"{config.service} desired={desired_count} running={running_count} pending={pending_count}"
            )
        time.sleep(config.poll_interval_seconds)


def _describe_service(ecs: Any, config: LlmServiceLifecycleConfig) -> dict[str, Any]:
    response = ecs.describe_services(cluster=config.cluster, services=[config.service])
    failures = response.get("failures") or []
    if failures:
        raise PipelineStageError(f"Failed to describe LLM ECS service {config.service}: {failures}")
    services = response.get("services") or []
    if not services:
        raise PipelineStageError(f"LLM ECS service not found: {config.service}")
    return dict(services[0])


def _wait_for_health(config: LlmServiceLifecycleConfig) -> None:
    if not config.health_url:
        return
    deadline = time.monotonic() + config.start_timeout_seconds
    last_error = "not ready"
    while True:
        ready, last_error = _health_ready(config)
        if ready:
            return
        if time.monotonic() >= deadline:
            raise PipelineStageError(f"Timed out waiting for LLM health endpoint {config.health_url}: {last_error}")
        time.sleep(config.poll_interval_seconds)


def _health_ready(config: LlmServiceLifecycleConfig) -> tuple[bool, str]:
    assert config.health_url is not None
    try:
        with urllib.request.urlopen(config.health_url, timeout=config.health_request_timeout_seconds) as response:
            status = int(response.status)
            return 200 <= status < 300, f"http_status={status}"
    except urllib.error.HTTPError as exc:
        status = int(exc.code)
        reason = str(exc.reason or exc.msg or "").strip()
        detail = f"http_error={status}"
        if reason:
            detail = f"{detail} {reason}"
        return 200 <= status < 300, detail
    except OSError as exc:
        return False, str(exc) or type(exc).__name__


def _health_url_from_runtime_base_url() -> str | None:
    base_url = _optional_env("LLM_RUNTIME_BASE_URL")
    if not base_url:
        return None
    normalized = base_url.rstrip("/")
    if normalized.endswith("/v1"):
        normalized = normalized[:-3].rstrip("/")
    return f"{normalized}/health"


def _bool_env(name: str, *, default: bool) -> bool:
    value = _optional_env(name)
    if value is None:
        return default
    normalized = value.lower()
    if normalized in {"1", "true", "yes", "y", "on"}:
        return True
    if normalized in {"0", "false", "no", "n", "off"}:
        return False
    raise PipelineConfigurationError(f"{name} must be a boolean value.")


def _positive_int_env(name: str, default: int) -> int:
    value = _optional_env(name)
    if value is None:
        return default
    try:
        parsed = int(value)
    except ValueError as exc:
        raise PipelineConfigurationError(f"{name} must be an integer.") from exc
    if parsed <= 0:
        raise PipelineConfigurationError(f"{name} must be greater than 0.")
    return parsed


def _positive_float_env(name: str, default: float) -> float:
    value = _optional_env(name)
    if value is None:
        return default
    try:
        parsed = float(value)
    except ValueError as exc:
        raise PipelineConfigurationError(f"{name} must be a number.") from exc
    if parsed <= 0:
        raise PipelineConfigurationError(f"{name} must be greater than 0.")
    return parsed


def _optional_env(name: str) -> str | None:
    value = os.getenv(name)
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


__all__ = ["start_llm_service", "stop_llm_service"]
