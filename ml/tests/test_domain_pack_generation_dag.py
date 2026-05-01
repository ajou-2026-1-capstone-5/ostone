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

    def fake_dag(*_args: object, **_kwargs: object) -> Any:
        def decorator(_function: Any) -> Any:
            return lambda: None

        return decorator

    def fake_task(*_args: object, **_kwargs: object) -> Any:
        def decorator(function: Any) -> Any:
            return function

        return decorator

    setattr(airflow_sdk_module, "dag", fake_dag)
    setattr(airflow_sdk_module, "task", fake_task)
    setattr(airflow_sdk_module, "get_current_context", lambda: {})
    monkeypatch.setitem(sys.modules, "airflow", airflow_module)
    monkeypatch.setitem(sys.modules, "airflow.sdk", airflow_sdk_module)
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
