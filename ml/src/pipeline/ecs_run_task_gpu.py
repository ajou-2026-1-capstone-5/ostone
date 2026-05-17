from __future__ import annotations

import time
from typing import Any

import boto3
from airflow.models import BaseOperator
from airflow.utils.decorators import apply_defaults


class EcsGpuRunTaskOperator(BaseOperator):
    @apply_defaults
    def __init__(
        self,
        *,
        cluster_name: str,
        task_definition: str,
        capacity_provider: str,
        asg_name: str,
        network_configuration: dict[str, Any],
        overrides: dict[str, Any] | None = None,
        container_name: str = "gpu-worker",
        poll_interval: int = 30,
        task_timeout: int = 3600,
        asg_poll_attempts: int = 12,
        region_name: str = "ap-northeast-2",
        aws_conn_id: str | None = None,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.cluster_name = cluster_name
        self.task_definition = task_definition
        self.capacity_provider = capacity_provider
        self.asg_name = asg_name
        self.network_configuration = network_configuration
        self.overrides = overrides or {}
        self.container_name = container_name
        self.poll_interval = poll_interval
        self.task_timeout = task_timeout
        self.asg_poll_attempts = asg_poll_attempts
        self.region_name = region_name
        self.aws_conn_id = aws_conn_id

    def _get_ecs_client(self):
        return boto3.client("ecs", region_name=self.region_name)

    def _get_asg_client(self):
        return boto3.client("autoscaling", region_name=self.region_name)

    def _scale_asg(self, desired: int) -> None:
        self.log.info("Setting ASG %s desired=%d", self.asg_name, desired)
        self._get_asg_client().set_desired_capacity(
            AutoScalingGroupName=self.asg_name,
            DesiredCapacity=desired,
        )

    def _wait_for_gpu_instance(self) -> str | None:
        ecs = self._get_ecs_client()
        for attempt in range(self.asg_poll_attempts):
            result = ecs.list_container_instances(cluster=self.cluster_name)
            arns = result.get("containerInstanceArns", [])
            if not arns:
                self.log.info(
                    "Waiting for GPU instance... (%d/%d)",
                    attempt + 1,
                    self.asg_poll_attempts,
                )
                time.sleep(self.poll_interval)
                continue

            desc = ecs.describe_container_instances(
                cluster=self.cluster_name,
                containerInstances=arns,
            )
            for inst in desc.get("containerInstances", []):
                for attr in inst.get("attributes", []):
                    if attr.get("name") == "ecs.capability.gpu":
                        self.log.info(
                            "GPU instance %s registered",
                            inst["containerInstanceArn"],
                        )
                        return inst["containerInstanceArn"]

        self.log.warning("GPU instance did not register within expected time")
        return None

    def _run_task(self) -> str | None:
        ecs = self._get_ecs_client()
        kwargs: dict[str, Any] = {
            "cluster": self.cluster_name,
            "taskDefinition": self.task_definition,
            "capacityProviderStrategy": [{"capacityProvider": self.capacity_provider, "weight": 1}],
            "networkConfiguration": self.network_configuration,
        }
        if self.overrides:
            kwargs["overrides"] = self.overrides

        response = ecs.run_task(**kwargs)
        tasks = response.get("tasks", [])
        if not tasks:
            self.log.error("RunTask failed: %s", response.get("failures", []))
            return None
        task_arn = tasks[0]["taskArn"]
        self.log.info("RunTask started: %s", task_arn)
        return task_arn

    def _poll_task(self, task_arn: str) -> str:
        ecs = self._get_ecs_client()
        deadline = time.time() + self.task_timeout
        while time.time() < deadline:
            response = ecs.describe_tasks(cluster=self.cluster_name, tasks=[task_arn])
            tasks = response.get("tasks", [])
            if tasks:
                status = tasks[0].get("lastStatus", "")
                self.log.info("Task status: %s", status)
                if status == "STOPPED":
                    exit_code = tasks[0].get("containers", [{}])[0].get("exitCode")
                    self.log.info("Task stopped with exit code: %s", exit_code)
                    return status
            time.sleep(self.poll_interval)
        return "TIMEOUT"

    def execute(self, context: dict[str, Any]) -> dict[str, str]:
        self.log.info("=== ECS GPU RunTask Operator START ===")
        try:
            self._scale_asg(1)
            self._wait_for_gpu_instance()

            task_arn = self._run_task()
            if not task_arn:
                raise RuntimeError("Failed to start GPU task")

            status = self._poll_task(task_arn)
            if status != "STOPPED":
                raise RuntimeError(f"GPU task ended with status: {status}")

            self.log.info("GPU task completed successfully")
            return {"taskArn": task_arn, "status": status}
        finally:
            self._scale_asg(0)
            self.log.info("=== ECS GPU RunTask Operator END ===")
