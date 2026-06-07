from __future__ import annotations

import urllib.error
from email.message import Message
from typing import Any

import pytest

from pipeline.common.exceptions import PipelineConfigurationError, PipelineStageError
from pipeline.llm_service_lifecycle import (
    LlmServiceLifecycleConfig,
    _config_from_env,
    _health_ready,
    _health_url_from_runtime_base_url,
    _wait_for_health,
    _wait_for_service_count,
    start_llm_service,
    stop_llm_service,
)


class FakeEcsClient:
    def __init__(self, services: list[dict[str, Any]] | None = None) -> None:
        self.services = services or [{"runningCount": 1, "pendingCount": 0}]
        self.update_calls: list[dict[str, Any]] = []
        self.describe_calls: list[dict[str, Any]] = []

    def update_service(self, **kwargs: Any) -> dict[str, Any]:
        self.update_calls.append(kwargs)
        return {"service": {"serviceName": kwargs["service"], "desiredCount": kwargs["desiredCount"]}}

    def describe_services(self, **kwargs: Any) -> dict[str, Any]:
        self.describe_calls.append(kwargs)
        service = self.services[min(len(self.describe_calls) - 1, len(self.services) - 1)]
        return {"services": [service]}


def test_start_llm_service_is_disabled_without_service_env(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_lifecycle_env(monkeypatch)

    assert start_llm_service() == {"enabled": False, "reason": "missing_pipeline_llm_ecs_service"}


def test_stop_llm_service_is_disabled_without_service_env(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_lifecycle_env(monkeypatch)

    assert stop_llm_service() == {"enabled": False, "reason": "missing_pipeline_llm_ecs_service"}


def test_lifecycle_can_be_explicitly_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_lifecycle_env(monkeypatch)
    _set_lifecycle_env(monkeypatch)
    monkeypatch.setenv("PIPELINE_LLM_SERVICE_LIFECYCLE_ENABLED", "false")

    assert _config_from_env() is None


def test_start_llm_service_requires_service_when_explicitly_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_lifecycle_env(monkeypatch)
    monkeypatch.setenv("PIPELINE_LLM_SERVICE_LIFECYCLE_ENABLED", "true")
    monkeypatch.setenv("PIPELINE_ECS_CLUSTER", "cluster")

    with pytest.raises(PipelineConfigurationError, match="PIPELINE_LLM_ECS_SERVICE"):
        start_llm_service()


def test_start_llm_service_requires_cluster(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_lifecycle_env(monkeypatch)
    monkeypatch.setenv("PIPELINE_LLM_ECS_SERVICE", "llm-service")

    with pytest.raises(PipelineConfigurationError, match="PIPELINE_LLM_ECS_CLUSTER"):
        start_llm_service()


def test_start_llm_service_updates_service_and_waits_for_health(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_lifecycle_env(monkeypatch)
    _set_lifecycle_env(monkeypatch)
    ecs = FakeEcsClient(services=[{"runningCount": 0, "pendingCount": 1}, {"runningCount": 1, "pendingCount": 0}])
    health_calls: list[str | None] = []

    monkeypatch.setattr("pipeline.llm_service_lifecycle.boto3.client", lambda service: ecs)
    monkeypatch.setattr("pipeline.llm_service_lifecycle.time.sleep", lambda _seconds: None)
    monkeypatch.setattr(
        "pipeline.llm_service_lifecycle._wait_for_health",
        lambda config: health_calls.append(config.health_url),
    )

    result = start_llm_service()

    assert result["enabled"] is True
    assert result["desiredCount"] == 1
    assert ecs.update_calls == [{"cluster": "cluster", "service": "llm-service", "desiredCount": 1}]
    assert len(ecs.describe_calls) == 2
    assert health_calls == ["http://llm.local:8000/health"]


def test_stop_llm_service_scales_service_to_zero(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_lifecycle_env(monkeypatch)
    _set_lifecycle_env(monkeypatch)
    ecs = FakeEcsClient(services=[{"runningCount": 1, "pendingCount": 0}, {"runningCount": 0, "pendingCount": 0}])

    monkeypatch.setattr("pipeline.llm_service_lifecycle.boto3.client", lambda service: ecs)
    monkeypatch.setattr("pipeline.llm_service_lifecycle.time.sleep", lambda _seconds: None)

    result = stop_llm_service()

    assert result == {"enabled": True, "cluster": "cluster", "service": "llm-service", "desiredCount": 0}
    assert ecs.update_calls == [{"cluster": "cluster", "service": "llm-service", "desiredCount": 0}]
    assert len(ecs.describe_calls) == 2


def test_wait_for_service_count_raises_on_describe_failure() -> None:
    class FailureEcsClient:
        def describe_services(self, **_kwargs: Any) -> dict[str, Any]:
            return {"failures": [{"reason": "missing"}]}

    with pytest.raises(PipelineStageError, match="Failed to describe LLM ECS service"):
        _wait_for_service_count(
            FailureEcsClient(),
            _config(),
            desired_count=1,
            timeout_seconds=1,
        )


def test_wait_for_service_count_times_out(monkeypatch: pytest.MonkeyPatch) -> None:
    monotonic_values = iter([0.0, 2.0])
    monkeypatch.setattr("pipeline.llm_service_lifecycle.time.monotonic", lambda: next(monotonic_values))

    with pytest.raises(PipelineStageError, match="Timed out waiting for LLM ECS service"):
        _wait_for_service_count(
            FakeEcsClient(services=[{"runningCount": 0, "pendingCount": 0}]),
            _config(),
            desired_count=1,
            timeout_seconds=1,
        )


def test_config_derives_health_url_from_llm_runtime_base_url(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_lifecycle_env(monkeypatch)
    _set_lifecycle_env(monkeypatch, health_url=None)
    monkeypatch.setenv("LLM_RUNTIME_BASE_URL", "http://llm.local:8000/v1")

    config = _config_from_env()

    assert config is not None
    assert config.health_url == "http://llm.local:8000/health"


def test_health_url_from_runtime_base_url_handles_non_v1_url(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_lifecycle_env(monkeypatch)
    monkeypatch.setenv("LLM_RUNTIME_BASE_URL", "http://llm.local:8000/openai")

    assert _health_url_from_runtime_base_url() == "http://llm.local:8000/openai/health"


def test_health_ready_rejects_http_error_below_500(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_urlopen(*_args: object, **_kwargs: object) -> object:
        raise urllib.error.HTTPError("http://llm.local/health", 404, "Not Found", Message(), None)

    monkeypatch.setattr("pipeline.llm_service_lifecycle.urllib.request.urlopen", fake_urlopen)

    assert _health_ready(_config()) == (False, "http_error=404 Not Found")


def test_health_ready_rejects_connection_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_urlopen(*_args: object, **_kwargs: object) -> object:
        raise OSError("connection refused")

    monkeypatch.setattr("pipeline.llm_service_lifecycle.urllib.request.urlopen", fake_urlopen)

    assert _health_ready(_config()) == (False, "connection refused")


def test_wait_for_health_times_out(monkeypatch: pytest.MonkeyPatch) -> None:
    monotonic_values = iter([0.0, 2.0])
    monkeypatch.setattr("pipeline.llm_service_lifecycle.time.monotonic", lambda: next(monotonic_values))
    monkeypatch.setattr("pipeline.llm_service_lifecycle._health_ready", lambda _config: (False, "connection refused"))

    with pytest.raises(PipelineStageError, match="connection refused"):
        _wait_for_health(_config())


@pytest.mark.parametrize(
    ("name", "value", "message"),
    [
        ("PIPELINE_LLM_SERVICE_LIFECYCLE_ENABLED", "maybe", "boolean"),
        ("PIPELINE_LLM_ECS_DESIRED_COUNT", "0", "greater than 0"),
        ("PIPELINE_LLM_SERVICE_POLL_INTERVAL_SECONDS", "soon", "number"),
    ],
)
def test_config_rejects_invalid_env_values(
    monkeypatch: pytest.MonkeyPatch,
    name: str,
    value: str,
    message: str,
) -> None:
    _clear_lifecycle_env(monkeypatch)
    _set_lifecycle_env(monkeypatch)
    monkeypatch.setenv(name, value)

    with pytest.raises(PipelineConfigurationError, match=message):
        _config_from_env()


def _config() -> LlmServiceLifecycleConfig:
    return LlmServiceLifecycleConfig(
        cluster="cluster",
        service="llm-service",
        desired_count=1,
        poll_interval_seconds=0.01,
        start_timeout_seconds=1,
        stop_timeout_seconds=1,
        health_url="http://llm.local:8000/health",
        health_request_timeout_seconds=0.01,
    )


def _set_lifecycle_env(
    monkeypatch: pytest.MonkeyPatch, *, health_url: str | None = "http://llm.local:8000/health"
) -> None:
    monkeypatch.setenv("PIPELINE_ECS_CLUSTER", "cluster")
    monkeypatch.setenv("PIPELINE_LLM_ECS_SERVICE", "llm-service")
    monkeypatch.setenv("PIPELINE_LLM_SERVICE_POLL_INTERVAL_SECONDS", "0.01")
    monkeypatch.setenv("PIPELINE_LLM_SERVICE_START_TIMEOUT_SECONDS", "1")
    monkeypatch.setenv("PIPELINE_LLM_SERVICE_STOP_TIMEOUT_SECONDS", "1")
    if health_url is None:
        monkeypatch.delenv("PIPELINE_LLM_HEALTH_URL", raising=False)
    else:
        monkeypatch.setenv("PIPELINE_LLM_HEALTH_URL", health_url)


def _clear_lifecycle_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in (
        "PIPELINE_LLM_SERVICE_LIFECYCLE_ENABLED",
        "PIPELINE_LLM_ECS_SERVICE",
        "PIPELINE_LLM_ECS_CLUSTER",
        "PIPELINE_LLM_ECS_DESIRED_COUNT",
        "PIPELINE_LLM_SERVICE_POLL_INTERVAL_SECONDS",
        "PIPELINE_LLM_SERVICE_START_TIMEOUT_SECONDS",
        "PIPELINE_LLM_SERVICE_STOP_TIMEOUT_SECONDS",
        "PIPELINE_LLM_HEALTH_URL",
        "PIPELINE_LLM_HEALTH_REQUEST_TIMEOUT_SECONDS",
        "PIPELINE_ECS_CLUSTER",
        "LLM_RUNTIME_BASE_URL",
    ):
        monkeypatch.delenv(key, raising=False)
