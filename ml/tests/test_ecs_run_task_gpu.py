from __future__ import annotations

import pytest

from pipeline.ecs_run_task_gpu import EcsGpuRunTaskOperator


class FakeAsgClient:
    def __init__(self, fail: bool = False) -> None:
        self.fail = fail
        self.calls: list[dict] = []

    def set_desired_capacity(self, **kwargs) -> None:
        if self.fail:
            raise RuntimeError("scale failed")
        self.calls.append(kwargs)


class FakeEcsClient:
    def __init__(
        self,
        *,
        container_arns: list[str] | None = None,
        instances: list[dict] | None = None,
        run_task_response: dict | None = None,
        describe_task_responses: list[dict] | None = None,
    ) -> None:
        self.container_arns = container_arns or []
        self.instances = instances or []
        self.run_task_response = run_task_response or {"tasks": []}
        self.describe_task_responses = describe_task_responses or []
        self.run_task_kwargs: dict | None = None

    def list_container_instances(self, **_kwargs) -> dict:
        return {"containerInstanceArns": self.container_arns}

    def describe_container_instances(self, **_kwargs) -> dict:
        return {"containerInstances": self.instances}

    def run_task(self, **kwargs) -> dict:
        self.run_task_kwargs = kwargs
        return self.run_task_response

    def describe_tasks(self, **_kwargs) -> dict:
        if self.describe_task_responses:
            return self.describe_task_responses.pop(0)
        return {"tasks": []}


def _operator() -> EcsGpuRunTaskOperator:
    return EcsGpuRunTaskOperator(
        task_id="gpu",
        cluster_name="cluster",
        task_definition="task",
        capacity_provider="gpu",
        asg_name="asg",
        network_configuration={},
        poll_interval=0,
        asg_poll_attempts=1,
    )


def test_scale_asg_calls_autoscaling_client(monkeypatch: pytest.MonkeyPatch) -> None:
    operator = _operator()
    asg = FakeAsgClient()
    monkeypatch.setattr(operator, "_get_asg_client", lambda: asg)

    operator._scale_asg(1)

    assert asg.calls == [{"AutoScalingGroupName": "asg", "DesiredCapacity": 1}]


def test_scale_asg_raises_runtime_error_on_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    operator = _operator()
    monkeypatch.setattr(operator, "_get_asg_client", lambda: FakeAsgClient(fail=True))

    with pytest.raises(RuntimeError, match="Failed to scale GPU ASG"):
        operator._scale_asg(1)


def test_wait_for_gpu_instance_returns_registered_gpu(monkeypatch: pytest.MonkeyPatch) -> None:
    operator = _operator()
    ecs = FakeEcsClient(
        container_arns=["container-1"],
        instances=[
            {
                "containerInstanceArn": "container-1",
                "attributes": [{"name": "ecs.capability.gpu"}],
            }
        ],
    )
    monkeypatch.setattr(operator, "_get_ecs_client", lambda: ecs)

    assert operator._wait_for_gpu_instance() == "container-1"


def test_wait_for_gpu_instance_returns_none_when_no_instance(monkeypatch: pytest.MonkeyPatch) -> None:
    operator = _operator()
    monkeypatch.setattr(operator, "_get_ecs_client", lambda: FakeEcsClient())
    monkeypatch.setattr("pipeline.ecs_run_task_gpu.time.sleep", lambda _seconds: None)

    assert operator._wait_for_gpu_instance() is None


def test_run_task_includes_overrides(monkeypatch: pytest.MonkeyPatch) -> None:
    operator = _operator()
    operator.overrides = {"containerOverrides": [{"name": "gpu-worker"}]}
    ecs = FakeEcsClient(run_task_response={"tasks": [{"taskArn": "task-1"}]})
    monkeypatch.setattr(operator, "_get_ecs_client", lambda: ecs)

    assert operator._run_task() == "task-1"
    assert ecs.run_task_kwargs is not None
    assert ecs.run_task_kwargs["overrides"] == operator.overrides
    assert ecs.run_task_kwargs["capacityProviderStrategy"] == [{"capacityProvider": "gpu", "weight": 1}]


def test_run_task_returns_none_when_ecs_returns_failures(monkeypatch: pytest.MonkeyPatch) -> None:
    operator = _operator()
    ecs = FakeEcsClient(run_task_response={"tasks": [], "failures": [{"reason": "no capacity"}]})
    monkeypatch.setattr(operator, "_get_ecs_client", lambda: ecs)

    assert operator._run_task() is None


def test_poll_task_returns_stopped_task(monkeypatch: pytest.MonkeyPatch) -> None:
    operator = _operator()
    ecs = FakeEcsClient(
        describe_task_responses=[
            {"tasks": [{"taskArn": "task-1", "lastStatus": "RUNNING"}]},
            {"tasks": [{"taskArn": "task-1", "lastStatus": "STOPPED", "containers": []}]},
        ]
    )
    monkeypatch.setattr(operator, "_get_ecs_client", lambda: ecs)
    monkeypatch.setattr("pipeline.ecs_run_task_gpu.time.sleep", lambda _seconds: None)

    assert operator._poll_task("task-1")["lastStatus"] == "STOPPED"


def test_poll_task_returns_timeout_when_deadline_passes() -> None:
    operator = _operator()
    operator.task_timeout = 0

    assert operator._poll_task("task-1") == {"lastStatus": "TIMEOUT", "taskArn": "task-1", "containers": []}


def test_execute_fails_when_gpu_instance_does_not_register(monkeypatch: pytest.MonkeyPatch) -> None:
    operator = _operator()
    monkeypatch.setattr(operator, "_scale_asg", lambda _desired: None)
    monkeypatch.setattr(operator, "_wait_for_gpu_instance", lambda: None)

    with pytest.raises(RuntimeError, match="GPU instance failed"):
        operator.execute({})


def test_execute_runs_task_and_scales_down(monkeypatch: pytest.MonkeyPatch) -> None:
    operator = _operator()
    desired_values: list[int] = []
    task = {
        "taskArn": "task-1",
        "lastStatus": "STOPPED",
        "containers": [{"name": "gpu-worker", "exitCode": 0}],
    }
    monkeypatch.setattr(operator, "_scale_asg", desired_values.append)
    monkeypatch.setattr(operator, "_wait_for_gpu_instance", lambda: "container-1")
    monkeypatch.setattr(operator, "_run_task", lambda: "task-1")
    monkeypatch.setattr(operator, "_poll_task", lambda _task_arn: task)

    assert operator.execute({}) == {"taskArn": "task-1", "status": "STOPPED"}
    assert desired_values == [1, 0]


def test_execute_scales_down_when_run_task_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    operator = _operator()
    desired_values: list[int] = []
    monkeypatch.setattr(operator, "_scale_asg", desired_values.append)
    monkeypatch.setattr(operator, "_wait_for_gpu_instance", lambda: "container-1")
    monkeypatch.setattr(operator, "_run_task", lambda: None)

    with pytest.raises(RuntimeError, match="Failed to start GPU task"):
        operator.execute({})
    assert desired_values == [1, 0]


def test_assert_successful_task_rejects_non_stopped_status() -> None:
    operator = _operator()

    with pytest.raises(RuntimeError, match="RUNNING"):
        operator._assert_successful_task({"taskArn": "arn:task", "lastStatus": "RUNNING"})


def test_assert_successful_task_rejects_missing_containers() -> None:
    operator = _operator()

    with pytest.raises(RuntimeError, match="without container details"):
        operator._assert_successful_task({"taskArn": "arn:task", "lastStatus": "STOPPED", "containers": []})


def test_assert_successful_task_rejects_nonzero_exit_code() -> None:
    operator = _operator()
    task = {
        "taskArn": "arn:task",
        "lastStatus": "STOPPED",
        "containers": [{"name": "gpu-worker", "exitCode": 2, "reason": "boom"}],
    }

    with pytest.raises(RuntimeError, match="exitCode=2"):
        operator._assert_successful_task(task)


def test_assert_successful_task_accepts_zero_exit_code() -> None:
    operator = _operator()
    task = {
        "taskArn": "arn:task",
        "lastStatus": "STOPPED",
        "containers": [{"name": "gpu-worker", "exitCode": 0}],
    }

    assert operator._assert_successful_task(task) == "STOPPED"
