"""Submit one ML pipeline stage as a separate ECS task."""

from __future__ import annotations

import os
import time
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

import boto3

from pipeline.common.artifact_io import read_json_uri
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineConfigurationError, PipelineStageError

DEFAULT_GPU_STAGES = {"representation"}


@dataclass(frozen=True)
class EcsStageTaskConfig:
    cluster: str
    cpu_task_definition: str
    cpu_container_name: str
    gpu_task_definition: str | None
    gpu_container_name: str
    gpu_capacity_provider: str | None
    subnet_ids: tuple[str, ...]
    security_group_ids: tuple[str, ...]
    assign_public_ip: str
    result_bucket: str
    result_prefix: str
    poll_interval_seconds: float
    task_timeout_seconds: float
    gpu_stages: frozenset[str]

    @classmethod
    def from_env(cls, runtime_config: PipelineRuntimeConfig) -> "EcsStageTaskConfig":
        result_bucket = _env("PIPELINE_ECS_RESULT_BUCKET") or runtime_config.artifact_bucket
        if not result_bucket:
            raise PipelineConfigurationError("PIPELINE_ECS_RESULT_BUCKET or ML_ARTIFACT_BUCKET is required.")
        subnet_ids = _csv_env("PIPELINE_ECS_SUBNET_IDS")
        security_group_ids = _csv_env("PIPELINE_ECS_SECURITY_GROUP_IDS")
        if not subnet_ids:
            raise PipelineConfigurationError("PIPELINE_ECS_SUBNET_IDS is required for ECS stage execution.")
        if not security_group_ids:
            raise PipelineConfigurationError("PIPELINE_ECS_SECURITY_GROUP_IDS is required for ECS stage execution.")
        return cls(
            cluster=_required_env("PIPELINE_ECS_CLUSTER"),
            cpu_task_definition=_required_env("PIPELINE_ECS_CPU_TASK_DEFINITION"),
            cpu_container_name=_env("PIPELINE_ECS_CPU_CONTAINER_NAME") or "ml-stage-cpu",
            gpu_task_definition=_env("PIPELINE_ECS_GPU_TASK_DEFINITION"),
            gpu_container_name=_env("PIPELINE_ECS_GPU_CONTAINER_NAME") or "ml-stage-gpu",
            gpu_capacity_provider=_env("PIPELINE_ECS_GPU_CAPACITY_PROVIDER"),
            subnet_ids=subnet_ids,
            security_group_ids=security_group_ids,
            assign_public_ip=(_env("PIPELINE_ECS_ASSIGN_PUBLIC_IP") or "DISABLED").upper(),
            result_bucket=result_bucket,
            result_prefix=(_env("PIPELINE_ECS_RESULT_PREFIX") or "ecs-stage-results").strip("/"),
            poll_interval_seconds=float(_env("PIPELINE_ECS_POLL_INTERVAL_SECONDS") or "15"),
            task_timeout_seconds=float(_env("PIPELINE_ECS_TASK_TIMEOUT_SECONDS") or "21600"),
            gpu_stages=frozenset(_csv_env("PIPELINE_ECS_GPU_STAGES") or DEFAULT_GPU_STAGES),
        )


def run_stage_task(
    stage_name: str,
    stage_context: StageContext,
    runtime_config: PipelineRuntimeConfig,
    upstream_manifest_path: str | None,
) -> dict[str, str]:
    ecs_config = EcsStageTaskConfig.from_env(runtime_config)
    result_uri = _result_uri(ecs_config, stage_context)
    task_payload = _submit_task(
        ecs_config,
        stage_name,
        stage_context,
        runtime_config,
        upstream_manifest_path,
        result_uri,
    )
    task_arn = _task_arn(task_payload)
    _wait_for_task(ecs_config, task_arn)
    result = read_json_uri(result_uri)
    manifest_uri = result.get("artifact_manifest_path") or result.get("manifestUri")
    if not isinstance(manifest_uri, str) or not manifest_uri:
        raise PipelineStageError(f"ECS stage result missing artifact_manifest_path: {result_uri}")
    return {"artifact_manifest_path": manifest_uri}


def _submit_task(
    ecs_config: EcsStageTaskConfig,
    stage_name: str,
    stage_context: StageContext,
    runtime_config: PipelineRuntimeConfig,
    upstream_manifest_path: str | None,
    result_uri: str,
) -> Mapping[str, Any]:
    task_definition = _task_definition_for_stage(ecs_config, stage_name)
    container_name = _container_name_for_stage(ecs_config, stage_name)
    response = boto3.client("ecs").run_task(
        cluster=ecs_config.cluster,
        taskDefinition=task_definition,
        count=1,
        **_placement_for_stage(ecs_config, stage_name),
        networkConfiguration={
            "awsvpcConfiguration": {
                "subnets": list(ecs_config.subnet_ids),
                "securityGroups": list(ecs_config.security_group_ids),
                "assignPublicIp": ecs_config.assign_public_ip,
            }
        },
        overrides={
            "containerOverrides": [
                {
                    "name": container_name,
                    "environment": _container_environment(
                        stage_name,
                        stage_context,
                        runtime_config,
                        upstream_manifest_path,
                        result_uri,
                    ),
                }
            ]
        },
    )
    failures = response.get("failures") or []
    if failures:
        raise PipelineStageError(f"ECS RunTask failed for {stage_name}: {failures}")
    return response


def _wait_for_task(ecs_config: EcsStageTaskConfig, task_arn: str) -> None:
    ecs = boto3.client("ecs")
    deadline = time.monotonic() + ecs_config.task_timeout_seconds
    while True:
        response = ecs.describe_tasks(cluster=ecs_config.cluster, tasks=[task_arn])
        tasks = response.get("tasks") or []
        if not tasks:
            raise PipelineStageError(f"ECS task disappeared before completion: {task_arn}")
        task = tasks[0]
        status = task.get("lastStatus")
        if status == "STOPPED":
            _raise_for_stopped_task(task)
            return
        if time.monotonic() >= deadline:
            raise PipelineStageError(f"ECS task timed out: {task_arn}")
        time.sleep(ecs_config.poll_interval_seconds)


def _raise_for_stopped_task(task: Mapping[str, Any]) -> None:
    containers = task.get("containers") or []
    failed_containers = [
        container
        for container in containers
        if isinstance(container, Mapping) and int(container.get("exitCode") or 0) != 0
    ]
    if failed_containers:
        reason = failed_containers[0].get("reason") or task.get("stoppedReason") or "container failed"
        exit_code = failed_containers[0].get("exitCode")
        raise PipelineStageError(f"ECS stage task failed with exitCode={exit_code}: {reason}")
    stopped_reason = str(task.get("stoppedReason") or "")
    if stopped_reason and "Essential container in task exited" not in stopped_reason:
        raise PipelineStageError(f"ECS stage task stopped unexpectedly: {stopped_reason}")


def _container_environment(
    stage_name: str,
    stage_context: StageContext,
    runtime_config: PipelineRuntimeConfig,
    upstream_manifest_path: str | None,
    result_uri: str,
) -> list[dict[str, str]]:
    values: dict[str, str | None] = {
        "PIPELINE_STAGE_NAME": stage_name,
        "PIPELINE_STAGE_RESULT_URI": result_uri,
        "PIPELINE_UPSTREAM_MANIFEST_URI": upstream_manifest_path,
        "PIPELINE_BACKEND_BASE_URL": runtime_config.backend_base_url,
        "PIPELINE_CALLBACK_ENABLED": str(runtime_config.callback_enabled).lower(),
        "PIPELINE_CALLBACK_TIMEOUT_SECONDS": str(runtime_config.callback_timeout_seconds),
        "AIRFLOW_DAG_ID": stage_context.dag_id,
        "AIRFLOW_RUN_ID": stage_context.run_id,
        "PIPELINE_WORKSPACE_ID": stage_context.workspace_id,
        "PIPELINE_DATASET_ID": stage_context.dataset_id,
        "PIPELINE_JOB_ID": stage_context.pipeline_job_id,
        "PIPELINE_RAW_OBJECT_KEY": _conf_env("PIPELINE_RAW_OBJECT_KEY", "AIRFLOW_OBJECT_KEY"),
        "ML_ARTIFACT_STORE": runtime_config.artifact_store,
        "ML_ARTIFACT_BUCKET": runtime_config.artifact_bucket,
        "ML_ARTIFACT_PREFIX": runtime_config.artifact_prefix,
        "EMBEDDING_MODEL_NAME": runtime_config.embedding_model_name,
        "ML_EMBEDDING_RUNTIME": runtime_config.embedding_runtime,
        "LLM_MODEL_NAME": runtime_config.llm_model_name,
        "LLM_RUNTIME_BASE_URL": runtime_config.llm_runtime_base_url,
        "LLM_RUNTIME_API_KEY": runtime_config.llm_runtime_api_key,
        "ML_RUNTIME_PROFILE": runtime_config.runtime_profile,
        "GPU_TASK_MODE": runtime_config.gpu_task_mode,
        "AIRFLOW_WEBHOOK_SECRET": runtime_config.airflow_webhook_secret,
        "S3_EXPECTED_BUCKET_OWNER": _env("S3_EXPECTED_BUCKET_OWNER"),
        "AWS_REGION": _env("AWS_REGION") or _env("AWS_DEFAULT_REGION"),
        "AWS_DEFAULT_REGION": _env("AWS_DEFAULT_REGION") or _env("AWS_REGION"),
        "PIPELINE_CONFIRMED_DOMAIN_PROFILE_PATH": _env("PIPELINE_CONFIRMED_DOMAIN_PROFILE_PATH"),
        "PIPELINE_FEEDBACK_CONSTRAINTS_PATH": _env("PIPELINE_FEEDBACK_CONSTRAINTS_PATH"),
    }
    environment: list[dict[str, str]] = []
    for key, value in values.items():
        if value is None or value == "":
            continue
        environment.append({"name": key, "value": value})
    return environment


def _placement_for_stage(ecs_config: EcsStageTaskConfig, stage_name: str) -> dict[str, Any]:
    if stage_name in ecs_config.gpu_stages:
        if ecs_config.gpu_capacity_provider:
            return {"capacityProviderStrategy": [{"capacityProvider": ecs_config.gpu_capacity_provider, "weight": 1}]}
        return {"launchType": "EC2"}
    return {"launchType": "FARGATE", "platformVersion": "LATEST"}


def _task_definition_for_stage(ecs_config: EcsStageTaskConfig, stage_name: str) -> str:
    if stage_name in ecs_config.gpu_stages:
        return ecs_config.gpu_task_definition or ecs_config.cpu_task_definition
    return ecs_config.cpu_task_definition


def _container_name_for_stage(ecs_config: EcsStageTaskConfig, stage_name: str) -> str:
    if stage_name in ecs_config.gpu_stages and ecs_config.gpu_task_definition:
        return ecs_config.gpu_container_name
    return ecs_config.cpu_container_name


def _task_arn(response: Mapping[str, Any]) -> str:
    tasks = response.get("tasks") or []
    if not tasks or not isinstance(tasks[0], Mapping):
        raise PipelineStageError(f"ECS RunTask returned no tasks: {response}")
    task_arn = tasks[0].get("taskArn")
    if not isinstance(task_arn, str) or not task_arn:
        raise PipelineStageError(f"ECS RunTask returned no taskArn: {response}")
    return task_arn


def _result_uri(ecs_config: EcsStageTaskConfig, stage_context: StageContext) -> str:
    safe_run_id = stage_context.run_id.replace("/", "__")
    key = "/".join(
        part
        for part in (
            ecs_config.result_prefix,
            stage_context.dag_id,
            safe_run_id,
            f"{stage_context.stage_name}.json",
        )
        if part
    )
    return f"s3://{ecs_config.result_bucket}/{key}"


def _required_env(name: str) -> str:
    value = _env(name)
    if not value:
        raise PipelineConfigurationError(f"{name} is required for ECS stage execution.")
    return value


def _env(name: str) -> str | None:
    value = os.getenv(name)
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _csv_env(name: str) -> tuple[str, ...]:
    value = _env(name)
    if not value:
        return ()
    return tuple(item.strip() for item in value.split(",") if item.strip())


def _conf_env(*names: str) -> str | None:
    for name in names:
        value = _env(name)
        if value:
            return value
    return None
