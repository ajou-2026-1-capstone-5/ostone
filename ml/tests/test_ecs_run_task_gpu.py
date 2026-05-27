from __future__ import annotations

import pytest

from pipeline.ecs_run_task_gpu import EcsGpuRunTaskOperator


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


def test_execute_fails_when_gpu_instance_does_not_register(monkeypatch: pytest.MonkeyPatch) -> None:
    operator = _operator()
    monkeypatch.setattr(operator, "_scale_asg", lambda _desired: None)
    monkeypatch.setattr(operator, "_wait_for_gpu_instance", lambda: None)

    with pytest.raises(RuntimeError, match="GPU instance failed"):
        operator.execute({})


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
