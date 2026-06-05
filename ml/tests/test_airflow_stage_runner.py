from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from pipeline.airflow_stage_runner import (
    DirectStageRunner,
    EcsStageRunner,
    StageRunRequest,
    create_stage_runner,
    stage_execution_mode_from_env,
)
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineConfigurationError


def test_stage_runner_factory_selects_direct_and_ecs(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("PIPELINE_STAGE_EXECUTION_MODE", raising=False)
    assert isinstance(create_stage_runner(), DirectStageRunner)

    monkeypatch.setenv("PIPELINE_STAGE_EXECUTION_MODE", "ecs")
    assert stage_execution_mode_from_env() == "ecs"
    assert isinstance(create_stage_runner(), EcsStageRunner)

    with pytest.raises(PipelineConfigurationError, match="direct, ecs"):
        create_stage_runner("unknown")


def test_direct_stage_runner_merges_stage_payload_into_manifest(tmp_path: Path) -> None:
    def stage_callable(_upstream_manifest_path: str | None) -> dict[str, Any]:
        return {"candidateArtifactPath": "/tmp/publish_candidate_input.json"}

    result = DirectStageRunner().run(
        StageRunRequest(
            stage_name="evaluation",
            stage_context=_stage_context("evaluation"),
            runtime_config=_runtime_config(tmp_path),
            stage_callable=stage_callable,
        )
    )

    manifest = json.loads(Path(result["artifact_manifest_path"]).read_text(encoding="utf-8"))
    assert manifest["payload"]["status"] == "completed"
    assert manifest["payload"]["candidateArtifactPath"] == "/tmp/publish_candidate_input.json"


def test_direct_stage_runner_reuses_existing_manifest_path(tmp_path: Path) -> None:
    result = DirectStageRunner().run(
        StageRunRequest(
            stage_name="evaluation",
            stage_context=_stage_context("evaluation"),
            runtime_config=_runtime_config(tmp_path),
            stage_callable=lambda _path: {"artifact_manifest_path": "/tmp/existing.json"},
        )
    )

    assert result == {"artifact_manifest_path": "/tmp/existing.json"}
    assert not (tmp_path / "dag").exists()


def test_direct_stage_runner_writes_failure_manifest(tmp_path: Path) -> None:
    class StageFailure(RuntimeError):
        manifest_payload = {"publish_status": "FAILED", "failed_callback_type": "intent-drafts"}

    def failing_stage(_path: str | None) -> None:
        raise StageFailure("callback failed")

    with pytest.raises(StageFailure):
        DirectStageRunner().run(
            StageRunRequest(
                stage_name="publish_candidate",
                stage_context=_stage_context("publish_candidate"),
                runtime_config=_runtime_config(tmp_path),
                upstream_manifest_path="/tmp/upstream.json",
                stage_callable=failing_stage,
            )
        )

    manifest_path = tmp_path / "dag" / "run" / "publish_candidate" / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["payload"]["status"] == "failed"
    assert manifest["payload"]["publish_status"] == "FAILED"
    assert manifest["payload"]["failed_callback_type"] == "intent-drafts"
    assert manifest["payload"]["error"]["type"] == "StageFailure"


def test_ecs_stage_runner_delegates_to_stage_task(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    calls: dict[str, object] = {}

    def fake_run_stage_task(
        stage_name: str,
        stage_context: StageContext,
        runtime_config: PipelineRuntimeConfig,
        upstream_manifest_path: str | None,
        raw_object_key: str | None = None,
    ) -> dict[str, str]:
        calls["stage_name"] = stage_name
        calls["stage_context"] = stage_context
        calls["runtime_config"] = runtime_config
        calls["upstream_manifest_path"] = upstream_manifest_path
        calls["raw_object_key"] = raw_object_key
        return {"artifact_manifest_path": "s3://artifacts/dag/run/ingestion/manifest.json"}

    monkeypatch.setattr("pipeline.airflow_stage_runner.run_stage_task", fake_run_stage_task)

    request = StageRunRequest(
        stage_name="ingestion",
        stage_context=_stage_context("ingestion"),
        runtime_config=_runtime_config(tmp_path),
        upstream_manifest_path=None,
        raw_object_key="completed/workspaces/1/raw.zip",
    )

    assert EcsStageRunner().run(request) == {"artifact_manifest_path": "s3://artifacts/dag/run/ingestion/manifest.json"}
    assert calls["stage_name"] == "ingestion"
    assert calls["stage_context"] == request.stage_context
    assert calls["runtime_config"] == request.runtime_config
    assert calls["upstream_manifest_path"] is None
    assert calls["raw_object_key"] == "completed/workspaces/1/raw.zip"


def _runtime_config(tmp_path: Path) -> PipelineRuntimeConfig:
    return PipelineRuntimeConfig(
        artifact_root=tmp_path,
        backend_base_url="http://backend:8080",
        callback_enabled=False,
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
