from __future__ import annotations

from pathlib import Path
from typing import Any

from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.ecs_stage_task import run_stage_task


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
