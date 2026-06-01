from __future__ import annotations

import json
import os
import sys
import types
from pathlib import Path
from typing import Any

import pytest

import pipeline.ecs_stage_worker as worker
from pipeline.ecs_stage_worker import StageWorkerError, _stage_callable, run_worker


def _install_stage_module(monkeypatch: pytest.MonkeyPatch, name: str, run: Any) -> None:
    module = types.ModuleType(name)
    setattr(module, "run", run)
    monkeypatch.setitem(sys.modules, name, module)
    monkeypatch.setitem(worker.STAGE_MODULES, "test_stage", name)


def test_run_worker_executes_stage_and_writes_local_result(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    scratch = tmp_path / "scratch"
    result_path = tmp_path / "result.json"

    def run_stage(upstream_manifest_path: str | None) -> dict[str, object]:
        assert upstream_manifest_path is None
        artifact_root = Path(os.environ["PIPELINE_ARTIFACT_ROOT"])
        manifest = artifact_root / "dag" / "run" / "test_stage" / "manifest.json"
        manifest.parent.mkdir(parents=True)
        manifest.write_text('{"payload":{"status":"completed"}}', encoding="utf-8")
        return {"artifact_manifest_path": str(manifest)}

    _install_stage_module(monkeypatch, "tests.fake_stage_local", run_stage)
    monkeypatch.setenv("PIPELINE_STAGE_NAME", "test_stage")
    monkeypatch.setenv("PIPELINE_STAGE_RESULT_URI", str(result_path))
    monkeypatch.setenv("PIPELINE_STAGE_SCRATCH_ROOT", str(scratch))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    monkeypatch.setenv("PIPELINE_CALLBACK_ENABLED", "false")

    payload = run_worker()

    assert payload["manifestUri"] == str(scratch / "artifacts" / "dag" / "run" / "test_stage" / "manifest.json")
    assert json.loads(result_path.read_text(encoding="utf-8"))["stageName"] == "test_stage"


def test_run_worker_materializes_s3_inputs_and_returns_s3_manifest(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    scratch = tmp_path / "scratch"
    result_path = tmp_path / "result.json"
    calls: dict[str, str] = {}

    def fake_materialize(uri: str, target_root: Path, _runtime_config: object) -> Path:
        calls["upstream"] = uri
        manifest = target_root / "dag" / "run" / "previous" / "manifest.json"
        manifest.parent.mkdir(parents=True)
        manifest.write_text("{}", encoding="utf-8")
        return manifest

    def fake_download(uri: str, target_path: Path) -> Path:
        calls["review_input"] = uri
        target_path.parent.mkdir(parents=True)
        target_path.write_text("{}", encoding="utf-8")
        return target_path

    def run_stage(upstream_manifest_path: str | None) -> dict[str, object]:
        assert upstream_manifest_path == str(scratch / "artifacts" / "dag" / "run" / "previous" / "manifest.json")
        assert Path(os.environ["PIPELINE_CONFIRMED_DOMAIN_PROFILE_PATH"]).exists()
        artifact_root = Path(os.environ["PIPELINE_ARTIFACT_ROOT"])
        manifest = artifact_root / "dag" / "manual__run" / "test_stage" / "manifest.json"
        manifest.parent.mkdir(parents=True)
        manifest.write_text(
            json.dumps(
                {
                    "artifact_bucket": "artifact-bucket",
                    "artifact_prefix": "domain-pack",
                    "artifact_root": str(artifact_root),
                    "dag_id": "dag",
                    "run_id": "manual/run",
                    "stage_name": "test_stage",
                    "payload": {},
                }
            ),
            encoding="utf-8",
        )
        return {"artifact_manifest_path": str(manifest)}

    _install_stage_module(monkeypatch, "tests.fake_stage_s3", run_stage)
    monkeypatch.setattr("pipeline.ecs_stage_worker.materialize_manifest_uri", fake_materialize)
    monkeypatch.setattr("pipeline.ecs_stage_worker.download_s3_uri", fake_download)
    monkeypatch.setenv("PIPELINE_STAGE_NAME", "test_stage")
    monkeypatch.setenv("PIPELINE_STAGE_RESULT_URI", str(result_path))
    monkeypatch.setenv("PIPELINE_STAGE_SCRATCH_ROOT", str(scratch))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    monkeypatch.setenv("PIPELINE_CALLBACK_ENABLED", "false")
    monkeypatch.setenv("ML_ARTIFACT_STORE", "s3")
    monkeypatch.setenv("ML_ARTIFACT_BUCKET", "artifact-bucket")
    monkeypatch.setenv("ML_ARTIFACT_PREFIX", "domain-pack")
    monkeypatch.setenv(
        "PIPELINE_UPSTREAM_MANIFEST_URI", "s3://artifact-bucket/domain-pack/dag/run/previous/manifest.json"
    )
    monkeypatch.setenv("PIPELINE_CONFIRMED_DOMAIN_PROFILE_PATH", "s3://artifact-bucket/review/domain.json")

    payload = run_worker()

    assert calls == {
        "upstream": "s3://artifact-bucket/domain-pack/dag/run/previous/manifest.json",
        "review_input": "s3://artifact-bucket/review/domain.json",
    }
    assert (
        payload["artifact_manifest_path"] == "s3://artifact-bucket/domain-pack/dag/manual__run/test_stage/manifest.json"
    )


def test_run_worker_requires_stage_name(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PIPELINE_STAGE_RESULT_URI", str(tmp_path / "result.json"))

    with pytest.raises(StageWorkerError, match="PIPELINE_STAGE_NAME"):
        run_worker()


def test_stage_callable_rejects_unsupported_stage() -> None:
    with pytest.raises(StageWorkerError, match="Unsupported PIPELINE_STAGE_NAME"):
        _stage_callable("unknown")
