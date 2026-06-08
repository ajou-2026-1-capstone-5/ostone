from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineConfigurationError, PipelineStageError
from pipeline.ecs_stage_task import EcsStageTaskConfig, _failure_message_from_result, run_stage_task


def test_run_stage_task_submits_ecs_task_and_returns_manifest(monkeypatch) -> None:
    calls: dict[str, Any] = {}

    class FakeEcsClient:
        def run_task(self, **kwargs: Any) -> dict[str, Any]:
            calls["run_task"] = kwargs
            return {"tasks": [{"taskArn": "arn:aws:ecs:task/123"}]}

        def describe_tasks(self, **kwargs: Any) -> dict[str, Any]:
            calls["describe_tasks"] = kwargs
            return {
                "tasks": [
                    {
                        "lastStatus": "STOPPED",
                        "stoppedReason": "Essential container in task exited",
                        "containers": [{"name": "ml-stage-cpu", "exitCode": 0}],
                    }
                ]
            }

    monkeypatch.setattr("pipeline.ecs_stage_task.boto3.client", lambda service: FakeEcsClient())
    monkeypatch.setattr(
        "pipeline.ecs_stage_task.read_json_uri",
        lambda uri: {"artifact_manifest_path": "s3://artifacts/domain-pack/dag/run/preprocessing/manifest.json"},
    )
    monkeypatch.setenv("PIPELINE_ECS_CLUSTER", "cluster")
    monkeypatch.setenv("PIPELINE_ECS_CPU_TASK_DEFINITION", "cpu-task")
    monkeypatch.setenv("PIPELINE_ECS_SUBNET_IDS", "subnet-a,subnet-b")
    monkeypatch.setenv("PIPELINE_ECS_SECURITY_GROUP_IDS", "sg-stage")
    monkeypatch.setenv("PIPELINE_ECS_POLL_INTERVAL_SECONDS", "0")
    monkeypatch.setenv("PIPELINE_DOMAIN_CANDIDATE_LLM_TIMEOUT_SECONDS", "90")

    runtime_config = PipelineRuntimeConfig(
        artifact_root=Path("/tmp/artifacts"),
        backend_base_url="https://api.example.com",
        callback_enabled=False,
        artifact_store="s3",
        artifact_bucket="artifacts",
        artifact_prefix="domain-pack",
    )
    stage_context = StageContext(
        dag_id="dag",
        run_id="run",
        stage_name="preprocessing",
        workspace_id="1",
        dataset_id="2",
        pipeline_job_id="3",
    )

    result = run_stage_task(
        "preprocessing",
        stage_context,
        runtime_config,
        "s3://artifacts/domain-pack/dag/run/ingestion/manifest.json",
    )

    assert result == {"artifact_manifest_path": "s3://artifacts/domain-pack/dag/run/preprocessing/manifest.json"}
    assert calls["run_task"]["cluster"] == "cluster"
    assert calls["run_task"]["taskDefinition"] == "cpu-task"
    assert calls["run_task"]["launchType"] == "FARGATE"
    environment = calls["run_task"]["overrides"]["containerOverrides"][0]["environment"]
    assert {"name": "PIPELINE_STAGE_NAME", "value": "preprocessing"} in environment
    assert {
        "name": "PIPELINE_UPSTREAM_MANIFEST_URI",
        "value": "s3://artifacts/domain-pack/dag/run/ingestion/manifest.json",
    } in environment
    assert {"name": "PIPELINE_DOMAIN_CANDIDATE_LLM_TIMEOUT_SECONDS", "value": "90"} in environment


def test_run_stage_task_forwards_raw_object_key_to_ingestion(monkeypatch) -> None:
    calls: dict[str, Any] = {}

    class FakeEcsClient:
        def run_task(self, **kwargs: Any) -> dict[str, Any]:
            calls["run_task"] = kwargs
            return {"tasks": [{"taskArn": "arn:aws:ecs:task/ingestion"}]}

        def describe_tasks(self, **_kwargs: Any) -> dict[str, Any]:
            return {
                "tasks": [
                    {
                        "lastStatus": "STOPPED",
                        "stoppedReason": "Essential container in task exited",
                        "containers": [{"name": "ml-stage-cpu", "exitCode": 0}],
                    }
                ]
            }

    monkeypatch.setattr("pipeline.ecs_stage_task.boto3.client", lambda service: FakeEcsClient())
    monkeypatch.setattr(
        "pipeline.ecs_stage_task.read_json_uri",
        lambda uri: {"artifact_manifest_path": "s3://artifacts/domain-pack/dag/run/ingestion/manifest.json"},
    )
    _set_required_ecs_env(monkeypatch)

    result = run_stage_task(
        "ingestion",
        _stage_context("ingestion"),
        _runtime_config(),
        None,
        raw_object_key="completed/workspaces/1/raw.zip",
    )

    assert result["artifact_manifest_path"] == "s3://artifacts/domain-pack/dag/run/ingestion/manifest.json"
    environment = calls["run_task"]["overrides"]["containerOverrides"][0]["environment"]
    assert {"name": "PIPELINE_RAW_OBJECT_KEY", "value": "completed/workspaces/1/raw.zip"} in environment


def test_run_stage_task_forwards_raw_storage_env(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: dict[str, Any] = {}

    class FakeEcsClient:
        def run_task(self, **kwargs: Any) -> dict[str, Any]:
            calls["run_task"] = kwargs
            return {"tasks": [{"taskArn": "arn:aws:ecs:task/ingestion"}]}

        def describe_tasks(self, **_kwargs: Any) -> dict[str, Any]:
            return {
                "tasks": [
                    {
                        "lastStatus": "STOPPED",
                        "stoppedReason": "Essential container in task exited",
                        "containers": [{"name": "ml-stage-cpu", "exitCode": 0}],
                    }
                ]
            }

    monkeypatch.setattr("pipeline.ecs_stage_task.boto3.client", lambda service: FakeEcsClient())
    monkeypatch.setattr(
        "pipeline.ecs_stage_task.read_json_uri",
        lambda uri: {"artifact_manifest_path": "s3://artifacts/domain-pack/dag/run/ingestion/manifest.json"},
    )
    _set_required_ecs_env(monkeypatch)
    monkeypatch.setenv("STORAGE_S3_BUCKET", "raw-files")
    monkeypatch.setenv("STORAGE_S3_REGION", "ap-northeast-2")
    monkeypatch.setenv("STORAGE_S3_ENDPOINT", "https://s3.example.test")
    monkeypatch.setenv("STORAGE_S3_ACCESS_KEY", "access")
    monkeypatch.setenv("STORAGE_S3_SECRET_KEY", "secret")
    monkeypatch.setenv("STORAGE_S3_PATH_STYLE", "true")

    run_stage_task("ingestion", _stage_context("ingestion"), _runtime_config(), None)

    environment = calls["run_task"]["overrides"]["containerOverrides"][0]["environment"]
    assert {"name": "STORAGE_S3_BUCKET", "value": "raw-files"} in environment
    assert {"name": "STORAGE_S3_REGION", "value": "ap-northeast-2"} in environment
    assert {"name": "STORAGE_S3_ENDPOINT", "value": "https://s3.example.test"} in environment
    assert {"name": "STORAGE_S3_ACCESS_KEY", "value": "access"} in environment
    assert {"name": "STORAGE_S3_SECRET_KEY", "value": "secret"} in environment
    assert {"name": "STORAGE_S3_PATH_STYLE", "value": "true"} in environment


def test_config_from_env_requires_network_settings(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PIPELINE_ECS_CLUSTER", "cluster")
    monkeypatch.setenv("PIPELINE_ECS_CPU_TASK_DEFINITION", "cpu-task")
    runtime_config = PipelineRuntimeConfig(
        artifact_root=tmp_path,
        backend_base_url="https://api.example.com",
        callback_enabled=False,
        artifact_store="s3",
        artifact_bucket="artifacts",
    )

    with pytest.raises(PipelineConfigurationError, match="PIPELINE_ECS_SUBNET_IDS"):
        EcsStageTaskConfig.from_env(runtime_config)


def test_run_stage_task_uses_gpu_capacity_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: dict[str, Any] = {}

    class FakeEcsClient:
        def run_task(self, **kwargs: Any) -> dict[str, Any]:
            calls["run_task"] = kwargs
            return {"tasks": [{"taskArn": "arn:aws:ecs:task/gpu"}]}

        def describe_tasks(self, **_kwargs: Any) -> dict[str, Any]:
            return {
                "tasks": [
                    {
                        "lastStatus": "STOPPED",
                        "stoppedReason": "Essential container in task exited",
                        "containers": [{"name": "ml-stage-gpu", "exitCode": 0}],
                    }
                ]
            }

    monkeypatch.setattr("pipeline.ecs_stage_task.boto3.client", lambda service: FakeEcsClient())
    monkeypatch.setattr(
        "pipeline.ecs_stage_task.read_json_uri",
        lambda uri: {"manifestUri": "s3://artifacts/domain-pack/dag/run/representation/manifest.json"},
    )
    _set_required_ecs_env(monkeypatch)
    monkeypatch.setenv("PIPELINE_ECS_GPU_TASK_DEFINITION", "gpu-task")
    monkeypatch.setenv("PIPELINE_ECS_GPU_CAPACITY_PROVIDER", "gpu-provider")

    result = run_stage_task("representation", _stage_context("representation"), _runtime_config(), None)

    assert result["artifact_manifest_path"] == "s3://artifacts/domain-pack/dag/run/representation/manifest.json"
    assert calls["run_task"]["taskDefinition"] == "gpu-task"
    assert calls["run_task"]["capacityProviderStrategy"] == [{"capacityProvider": "gpu-provider", "weight": 1}]
    assert calls["run_task"]["overrides"]["containerOverrides"][0]["name"] == "ml-stage-gpu"


def test_run_stage_task_raises_on_runtask_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeEcsClient:
        def run_task(self, **_kwargs: Any) -> dict[str, Any]:
            return {"failures": [{"arn": "task", "reason": "capacity"}]}

    monkeypatch.setattr("pipeline.ecs_stage_task.boto3.client", lambda service: FakeEcsClient())
    _set_required_ecs_env(monkeypatch)

    with pytest.raises(PipelineStageError, match="ECS RunTask failed"):
        run_stage_task("preprocessing", _stage_context("preprocessing"), _runtime_config(), None)


def test_run_stage_task_raises_on_container_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeEcsClient:
        def run_task(self, **_kwargs: Any) -> dict[str, Any]:
            return {"tasks": [{"taskArn": "arn:aws:ecs:task/failed"}]}

        def describe_tasks(self, **_kwargs: Any) -> dict[str, Any]:
            return {
                "tasks": [
                    {
                        "lastStatus": "STOPPED",
                        "stoppedReason": "Task failed",
                        "containers": [{"name": "ml-stage-cpu", "exitCode": 2, "reason": "boom"}],
                    }
                ]
            }

    monkeypatch.setattr("pipeline.ecs_stage_task.boto3.client", lambda service: FakeEcsClient())
    _set_required_ecs_env(monkeypatch)

    with pytest.raises(PipelineStageError, match="exitCode=2"):
        run_stage_task("preprocessing", _stage_context("preprocessing"), _runtime_config(), None)


def test_run_stage_task_includes_worker_failure_result(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeEcsClient:
        def run_task(self, **_kwargs: Any) -> dict[str, Any]:
            return {"tasks": [{"taskArn": "arn:aws:ecs:task/failed"}]}

        def describe_tasks(self, **_kwargs: Any) -> dict[str, Any]:
            return {
                "tasks": [
                    {
                        "lastStatus": "STOPPED",
                        "stoppedReason": "Essential container in task exited",
                        "containers": [{"name": "ml-stage-cpu", "exitCode": 1}],
                    }
                ]
            }

    monkeypatch.setattr("pipeline.ecs_stage_task.boto3.client", lambda service: FakeEcsClient())
    monkeypatch.setattr(
        "pipeline.ecs_stage_task.read_json_uri",
        lambda uri: {
            "status": "failed",
            "error": {"type": "PipelineStageError", "message": "Failed to read raw object from S3/MinIO: key=raw.zip"},
        },
    )
    _set_required_ecs_env(monkeypatch)

    with pytest.raises(PipelineStageError, match="Failed to read raw object from S3/MinIO: key=raw.zip"):
        run_stage_task("ingestion", _stage_context("ingestion"), _runtime_config(), None)


def test_failure_message_from_result_ignores_missing_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("pipeline.ecs_stage_task.read_json_uri", lambda _uri: {"status": "failed"})

    assert _failure_message_from_result("s3://artifacts/result.json") is None


def test_failure_message_from_result_ignores_blank_message(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "pipeline.ecs_stage_task.read_json_uri",
        lambda _uri: {"error": {"type": "PipelineStageError", "message": "  "}},
    )

    assert _failure_message_from_result("s3://artifacts/result.json") is None


def test_run_stage_task_requires_manifest_uri_in_result(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeEcsClient:
        def run_task(self, **_kwargs: Any) -> dict[str, Any]:
            return {"tasks": [{"taskArn": "arn:aws:ecs:task/123"}]}

        def describe_tasks(self, **_kwargs: Any) -> dict[str, Any]:
            return {
                "tasks": [
                    {
                        "lastStatus": "STOPPED",
                        "stoppedReason": "Essential container in task exited",
                        "containers": [{"name": "ml-stage-cpu", "exitCode": 0}],
                    }
                ]
            }

    monkeypatch.setattr("pipeline.ecs_stage_task.boto3.client", lambda service: FakeEcsClient())
    monkeypatch.setattr("pipeline.ecs_stage_task.read_json_uri", lambda uri: {"stageName": "preprocessing"})
    _set_required_ecs_env(monkeypatch)

    with pytest.raises(PipelineStageError, match="missing artifact_manifest_path"):
        run_stage_task("preprocessing", _stage_context("preprocessing"), _runtime_config(), None)


def _runtime_config() -> PipelineRuntimeConfig:
    return PipelineRuntimeConfig(
        artifact_root=Path("/tmp/artifacts"),
        backend_base_url="https://api.example.com",
        callback_enabled=False,
        artifact_store="s3",
        artifact_bucket="artifacts",
        artifact_prefix="domain-pack",
    )


def _stage_context(stage_name: str) -> StageContext:
    return StageContext(
        dag_id="dag",
        run_id="run",
        stage_name=stage_name,
        workspace_id="1",
        dataset_id="2",
        pipeline_job_id="3",
    )


def _set_required_ecs_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PIPELINE_ECS_CLUSTER", "cluster")
    monkeypatch.setenv("PIPELINE_ECS_CPU_TASK_DEFINITION", "cpu-task")
    monkeypatch.setenv("PIPELINE_ECS_SUBNET_IDS", "subnet-a")
    monkeypatch.setenv("PIPELINE_ECS_SECURITY_GROUP_IDS", "sg-stage")
    monkeypatch.setenv("PIPELINE_ECS_POLL_INTERVAL_SECONDS", "0")
