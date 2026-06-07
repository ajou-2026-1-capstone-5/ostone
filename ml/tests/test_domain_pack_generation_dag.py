from __future__ import annotations

import importlib
import json
import sys
import types
from pathlib import Path
from typing import Any

import pytest

from pipeline.common.exceptions import PipelineConfigurationError


def _import_dag_module(monkeypatch: pytest.MonkeyPatch) -> Any:
    airflow_module = types.ModuleType("airflow")
    airflow_sdk_module = types.ModuleType("airflow.sdk")
    airflow_exceptions_module = types.ModuleType("airflow.exceptions")

    class AirflowSkipException(Exception):
        pass

    def fake_dag(*_args: object, **_kwargs: object) -> Any:
        def decorator(_function: Any) -> Any:
            return lambda: None

        return decorator

    def fake_task(*_args: object, **_kwargs: object) -> Any:
        def decorator(function: Any) -> Any:
            return function

        return decorator

    airflow_module.__path__ = []
    setattr(airflow_sdk_module, "dag", fake_dag)
    setattr(airflow_sdk_module, "task", fake_task)
    setattr(airflow_sdk_module, "get_current_context", lambda: {})
    setattr(airflow_exceptions_module, "AirflowSkipException", AirflowSkipException)
    monkeypatch.setitem(sys.modules, "airflow", airflow_module)
    monkeypatch.setitem(sys.modules, "airflow.sdk", airflow_sdk_module)
    monkeypatch.setitem(sys.modules, "airflow.exceptions", airflow_exceptions_module)
    sys.modules.pop("dags.domain_pack_generation", None)
    return importlib.import_module("dags.domain_pack_generation")


def _patch_airflow_context(monkeypatch: pytest.MonkeyPatch, dag_module: Any) -> None:
    monkeypatch.setattr(
        dag_module,
        "get_current_context",
        lambda: {
            "dag": type("Dag", (), {"dag_id": "domain_pack_generation"})(),
            "run_id": "manual__run",
            "params": {"workspace_id": "3", "dataset_id": "5", "pipeline_job_id": "11"},
        },
    )


def test_stage_return_payload_is_merged_into_manifest(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    dag_module = _import_dag_module(monkeypatch)

    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(tmp_path))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    _patch_airflow_context(monkeypatch, dag_module)

    def stage_callable(_upstream_manifest_path: str | None) -> dict[str, Any]:
        return {"candidateArtifactPath": "/tmp/publish_candidate_input.json"}

    result = dag_module._run_stage("evaluation", stage_callable)
    manifest_path = Path(result["artifact_manifest_path"])
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    assert manifest["payload"]["status"] == "completed"
    assert manifest["payload"]["candidateArtifactPath"] == "/tmp/publish_candidate_input.json"


def test_stage_return_manifest_path_is_reused(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    dag_module = _import_dag_module(monkeypatch)
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(tmp_path))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    _patch_airflow_context(monkeypatch, dag_module)

    result = dag_module._run_stage("evaluation", lambda _path: {"artifact_manifest_path": "/tmp/existing.json"})

    assert result == {"artifact_manifest_path": "/tmp/existing.json"}
    assert not (tmp_path / "domain_pack_generation").exists()


def test_empty_stage_return_manifest_path_writes_manifest(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    dag_module = _import_dag_module(monkeypatch)
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(tmp_path))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    _patch_airflow_context(monkeypatch, dag_module)

    result = dag_module._run_stage("evaluation", lambda _path: {"artifact_manifest_path": "", "extra": "value"})
    manifest_path = Path(result["artifact_manifest_path"])
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    assert result["artifact_manifest_path"] != ""
    assert manifest["payload"]["status"] == "completed"
    assert manifest["payload"]["artifact_manifest_path"] == ""
    assert manifest["payload"]["extra"] == "value"


def test_failed_stage_writes_failure_manifest(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    dag_module = _import_dag_module(monkeypatch)
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(tmp_path))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    _patch_airflow_context(monkeypatch, dag_module)

    class StageFailure(RuntimeError):
        manifest_payload = {"publish_status": "FAILED", "failed_callback_type": "intent-drafts"}

    def failing_stage(_path: str | None) -> None:
        raise StageFailure("callback failed")

    with pytest.raises(StageFailure):
        dag_module._run_stage("publish_candidate", failing_stage, "/tmp/upstream.json")

    manifest_path = tmp_path / "domain_pack_generation" / "manual__run" / "publish_candidate" / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["payload"]["status"] == "failed"
    assert manifest["payload"]["publish_status"] == "FAILED"
    assert manifest["payload"]["failed_callback_type"] == "intent-drafts"
    assert manifest["payload"]["error"]["type"] == "StageFailure"


def test_ecs_ingestion_stage_forwards_conf_object_key(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    dag_module = _import_dag_module(monkeypatch)
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(tmp_path))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    monkeypatch.setenv("PIPELINE_STAGE_EXECUTION_MODE", "ecs")
    calls: dict[str, object] = {}

    class DagRun:
        conf = {
            "workspace_id": "3",
            "dataset_id": "5",
            "pipeline_job_id": "11",
            "object_key": "completed/workspaces/3/datasets/raw.zip",
        }

    monkeypatch.setattr(
        dag_module,
        "get_current_context",
        lambda: {
            "dag": type("Dag", (), {"dag_id": "domain_pack_generation"})(),
            "run_id": "manual__run",
            "dag_run": DagRun(),
        },
    )

    def fake_run_stage_task(
        stage_name: str,
        stage_context: object,
        runtime_config: object,
        upstream_manifest_path: str | None,
        raw_object_key: str | None = None,
    ) -> dict[str, str]:
        calls["stage_name"] = stage_name
        calls["raw_object_key"] = raw_object_key
        calls["upstream_manifest_path"] = upstream_manifest_path
        return {"artifact_manifest_path": "/tmp/manifest.json"}

    monkeypatch.setattr("pipeline.airflow_stage_runner.run_stage_task", fake_run_stage_task)
    monkeypatch.setattr(
        dag_module,
        "_stage_callable",
        lambda stage_name: pytest.fail(f"ECS mode must not resolve direct stage callable: {stage_name}"),
    )

    assert dag_module._run_stage("ingestion") == {"artifact_manifest_path": "/tmp/manifest.json"}
    assert calls == {
        "stage_name": "ingestion",
        "raw_object_key": "completed/workspaces/3/datasets/raw.zip",
        "upstream_manifest_path": None,
    }


def test_raw_object_key_for_stage_ignores_non_ingestion(monkeypatch: pytest.MonkeyPatch) -> None:
    dag_module = _import_dag_module(monkeypatch)

    assert dag_module._raw_object_key_for_stage("preprocessing") is None


def test_run_evaluation_stage_requires_upstream_manifest(monkeypatch: pytest.MonkeyPatch) -> None:
    dag_module = _import_dag_module(monkeypatch)

    with pytest.raises(PipelineConfigurationError):
        dag_module._run_evaluation_stage(None)


def test_run_evaluation_stage_delegates_to_evaluation_run(monkeypatch: pytest.MonkeyPatch) -> None:
    dag_module = _import_dag_module(monkeypatch)
    calls: list[str] = []

    def fake_evaluation_run(upstream_manifest_path: str) -> dict[str, object]:
        calls.append(upstream_manifest_path)
        return {"candidateArtifactPath": "/tmp/candidate.json"}

    monkeypatch.setattr(dag_module, "evaluation_run", fake_evaluation_run)

    assert dag_module._run_evaluation_stage("/tmp/upstream.json") == {"candidateArtifactPath": "/tmp/candidate.json"}
    assert calls == ["/tmp/upstream.json"]


def test_initial_llm_lifecycle_starts_only_for_initial_run(monkeypatch: pytest.MonkeyPatch) -> None:
    dag_module = _import_dag_module(monkeypatch)
    calls: list[str] = []

    monkeypatch.setattr(dag_module, "_run_mode", lambda: dag_module.RUN_MODE_INITIAL)
    monkeypatch.setattr(dag_module, "start_llm_ecs_service", lambda: calls.append("start") or {"enabled": True})

    assert dag_module._start_initial_llm_service() == {"enabled": True}
    assert calls == ["start"]

    monkeypatch.setattr(dag_module, "_run_mode", lambda: dag_module.RUN_MODE_DOMAIN_CONFIRMED_REPLAY)

    assert dag_module._start_initial_llm_service() == {"enabled": False, "reason": "not_initial_run"}
    assert calls == ["start"]


def test_initial_llm_lifecycle_stops_only_for_initial_run(monkeypatch: pytest.MonkeyPatch) -> None:
    dag_module = _import_dag_module(monkeypatch)
    calls: list[str] = []

    monkeypatch.setattr(dag_module, "_run_mode", lambda: dag_module.RUN_MODE_INITIAL)
    monkeypatch.setattr(dag_module, "stop_llm_ecs_service", lambda: calls.append("stop") or {"enabled": True})

    assert dag_module._stop_initial_llm_service() == {"enabled": True}
    assert calls == ["stop"]

    monkeypatch.setattr(dag_module, "_run_mode", lambda: dag_module.RUN_MODE_FEEDBACK_REPLAY)

    assert dag_module._stop_initial_llm_service() == {"enabled": False, "reason": "not_initial_run"}
    assert calls == ["stop"]


def test_set_task_dependency_links_airflow_task_like_objects(monkeypatch: pytest.MonkeyPatch) -> None:
    dag_module = _import_dag_module(monkeypatch)
    linked: list[tuple[str, str]] = []

    class FakeTask:
        def __init__(self, task_id: str) -> None:
            self.task_id = task_id

        def __rshift__(self, downstream: "FakeTask") -> "FakeTask":
            linked.append((self.task_id, downstream.task_id))
            return downstream

    dag_module._set_task_dependency(FakeTask("start"), FakeTask("stop"))

    assert linked == [("start", "stop")]


@pytest.mark.parametrize("value", ["true", "TRUE", " 1 ", "yes", "Y", "on"])
def test_conf_bool_accepts_true_values(monkeypatch: pytest.MonkeyPatch, value: str) -> None:
    dag_module = _import_dag_module(monkeypatch)

    class DagRun:
        conf = {"skip_feedback_checkpoint": value}

    monkeypatch.setattr(
        dag_module,
        "get_current_context",
        lambda: {"dag_run": DagRun()},
    )

    assert dag_module._conf_bool("skip_feedback_checkpoint") is True


@pytest.mark.parametrize("value", ["false", "FALSE", " 0 ", "no", "N", "off"])
def test_conf_bool_accepts_false_values(monkeypatch: pytest.MonkeyPatch, value: str) -> None:
    dag_module = _import_dag_module(monkeypatch)

    class DagRun:
        conf = {"skip_feedback_checkpoint": value}

    monkeypatch.setattr(
        dag_module,
        "get_current_context",
        lambda: {"dag_run": DagRun()},
    )

    assert dag_module._conf_bool("skip_feedback_checkpoint", default=True) is False


@pytest.mark.parametrize(("raw_value", "expected"), [(True, True), (False, False), (1, True), (0, False)])
def test_conf_bool_accepts_json_boolean_and_numeric_values(
    monkeypatch: pytest.MonkeyPatch,
    raw_value: bool | int,
    expected: bool,
) -> None:
    dag_module = _import_dag_module(monkeypatch)

    class DagRun:
        conf = {"skip_feedback_checkpoint": raw_value}

    monkeypatch.setattr(
        dag_module,
        "get_current_context",
        lambda: {"dag_run": DagRun()},
    )

    assert dag_module._conf_bool("skip_feedback_checkpoint", default=not expected) is expected


def test_conf_bool_uses_default_when_value_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    dag_module = _import_dag_module(monkeypatch)

    monkeypatch.setattr(
        dag_module,
        "get_current_context",
        lambda: {"dag_run": type("DagRun", (), {"conf": {}})()},
    )

    assert dag_module._conf_bool("skip_feedback_checkpoint", default=True) is True


def test_conf_bool_rejects_unknown_strings(monkeypatch: pytest.MonkeyPatch) -> None:
    dag_module = _import_dag_module(monkeypatch)

    class DagRun:
        conf = {"skip_feedback_checkpoint": "treu"}

    monkeypatch.setattr(
        dag_module,
        "get_current_context",
        lambda: {"dag_run": DagRun()},
    )

    with pytest.raises(PipelineConfigurationError, match="skip_feedback_checkpoint"):
        dag_module._conf_bool("skip_feedback_checkpoint")


def test_validated_replay_manifest_path_requires_artifact_root(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    dag_module = _import_dag_module(monkeypatch)
    runtime_config = dag_module.PipelineRuntimeConfig(
        artifact_root=tmp_path / "artifacts",
        backend_base_url="http://backend:8080",
        callback_enabled=False,
    )
    valid_manifest = tmp_path / "artifacts" / "domain_pack_generation" / "run" / "representation" / "manifest.json"
    valid_manifest.parent.mkdir(parents=True)
    valid_manifest.write_text("{}", encoding="utf-8")

    assert dag_module._validated_replay_manifest_path(str(valid_manifest), runtime_config) == valid_manifest.resolve()

    with pytest.raises(PipelineConfigurationError, match="PIPELINE_ARTIFACT_ROOT"):
        dag_module._validated_replay_manifest_path(str(tmp_path / "outside" / "manifest.json"), runtime_config)

    with pytest.raises(PipelineConfigurationError, match="manifest.json"):
        dag_module._validated_replay_manifest_path(str(valid_manifest.with_name("payload.json")), runtime_config)


def test_validated_replay_manifest_path_accepts_s3_manifest_under_bucket(monkeypatch: pytest.MonkeyPatch) -> None:
    dag_module = _import_dag_module(monkeypatch)
    runtime_config = dag_module.PipelineRuntimeConfig(
        artifact_root=Path("/tmp/artifacts"),
        backend_base_url="http://backend:8080",
        callback_enabled=False,
        artifact_store="s3",
        artifact_bucket="artifacts",
    )

    manifest_uri = "s3://artifacts/domain_pack_generation/run/representation/manifest.json"

    assert dag_module._validated_replay_manifest_path(manifest_uri, runtime_config) == manifest_uri


def test_checkpoint_callback_requires_enabled_callbacks(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    dag_module = _import_dag_module(monkeypatch)
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(tmp_path))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    monkeypatch.setenv("PIPELINE_CALLBACK_ENABLED", "false")
    _patch_airflow_context(monkeypatch, dag_module)

    upstream_manifest = tmp_path / "manifest.json"
    upstream_manifest.write_text('{"payload":{"domainCandidatesPath":"domain_candidates.json"}}', encoding="utf-8")
    (tmp_path / "domain_candidates.json").write_text('{"candidates":[]}', encoding="utf-8")

    with pytest.raises(PipelineConfigurationError, match="PIPELINE_CALLBACK_ENABLED=true"):
        dag_module._post_checkpoint_callback(
            stage_name="domain_confirmation_checkpoint",
            callback_type=dag_module.CALLBACK_DOMAIN_CONFIRMATION,
            upstream_manifest_path=str(upstream_manifest),
            artifact_payload_key="domainCandidates",
            artifact_path_key="domainCandidatesPath",
        )
