import json

import pytest

from pipeline.common.artifacts import write_stage_manifest
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineConfigurationError


def test_should_write_stage_manifest(tmp_path):
    runtime_config = PipelineRuntimeConfig(
        artifact_root=tmp_path,
        backend_base_url="http://backend:8080",
        callback_enabled=False,
    )
    stage_context = StageContext(
        dag_id="dev_bootstrap",
        run_id="manual__2026-04-15T00:00:00+00:00",
        stage_name="bootstrap_smoke",
        workspace_id="workspace-1",
        dataset_id="dataset-1",
        pipeline_job_id="pipeline-job-1",
    )

    manifest_path = write_stage_manifest(stage_context, runtime_config, {"status": "ok"})

    assert manifest_path.exists()
    assert manifest_path.parent == tmp_path / "dev_bootstrap" / "manual__2026-04-15T00:00:00+00:00" / "bootstrap_smoke"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["stage_name"] == "bootstrap_smoke"
    assert manifest["schemaVersion"] == "artifact-manifest.v2"
    assert manifest["stageName"] == "bootstrap_smoke"
    assert manifest["modelMetadata"]["embeddingModel"] == "BAAI/bge-m3"
    assert manifest["runtimeProfile"] == "cheap"
    assert manifest["checksum"]


def test_stage_manifest_includes_output_file_checksum(tmp_path):
    runtime_config = PipelineRuntimeConfig(
        artifact_root=tmp_path,
        backend_base_url="http://backend:8080",
        callback_enabled=False,
    )
    stage_context = StageContext(
        dag_id="dag",
        run_id="run",
        stage_name="stage",
        workspace_id=None,
        dataset_id=None,
        pipeline_job_id=None,
    )
    output_dir = tmp_path / "dag" / "run" / "stage"
    output_dir.mkdir(parents=True)
    artifact = output_dir / "artifact.json"
    artifact.write_text('{"ok":true}', encoding="utf-8")

    manifest_path = write_stage_manifest(stage_context, runtime_config, {"artifact_path": artifact.name})

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["outputArtifactRefs"][0]["type"] == "artifact_path"
    assert manifest["outputArtifactRefs"][0]["uri"] == "artifact.json"
    assert manifest["outputArtifactRefs"][0]["checksum"]


def test_runtime_config_rejects_blank_callback_secret(monkeypatch):
    monkeypatch.setenv("AIRFLOW_WEBHOOK_SECRET", "   ")

    with pytest.raises(PipelineConfigurationError, match="AIRFLOW_WEBHOOK_SECRET"):
        PipelineRuntimeConfig.from_env()


def test_runtime_config_direct_construction_rejects_missing_callback_secret(tmp_path):
    with pytest.raises(PipelineConfigurationError):
        PipelineRuntimeConfig(
            artifact_root=tmp_path,
            backend_base_url="http://backend:8080",
            callback_enabled=True,
        )


def test_runtime_config_direct_construction_normalizes_callback_secret(tmp_path):
    runtime_config = PipelineRuntimeConfig(
        artifact_root=tmp_path,
        backend_base_url="http://backend:8080",
        airflow_webhook_secret="  secret  ",
    )

    assert runtime_config.airflow_webhook_secret == "secret"


def test_runtime_config_strips_artifact_root_and_backend_base_url(monkeypatch, tmp_path):
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", f"  {tmp_path}  ")
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "  http://backend:8080/  ")
    monkeypatch.setenv("AIRFLOW_WEBHOOK_SECRET", "secret")

    runtime_config = PipelineRuntimeConfig.from_env()

    assert runtime_config.artifact_root == tmp_path
    assert runtime_config.backend_base_url == "http://backend:8080"


def test_runtime_config_rejects_s3_artifact_store_until_adapter_exists(monkeypatch, tmp_path):
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(tmp_path))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    monkeypatch.setenv("AIRFLOW_WEBHOOK_SECRET", "secret")
    monkeypatch.setenv("ML_ARTIFACT_STORE", "s3")
    monkeypatch.setenv("ML_ARTIFACT_BUCKET", "ml-artifacts")
    monkeypatch.setenv("ML_ARTIFACT_PREFIX", "/domain-pack/runs/")
    monkeypatch.setenv("EMBEDDING_MODEL_NAME", "custom-embedder")
    monkeypatch.setenv("LLM_MODEL_NAME", "custom-llm")
    monkeypatch.setenv("ML_RUNTIME_PROFILE", "balanced")
    monkeypatch.setenv("GPU_TASK_MODE", "service")

    with pytest.raises(PipelineConfigurationError, match="not implemented"):
        PipelineRuntimeConfig.from_env()


def test_runtime_config_requires_bucket_for_s3_artifact_store(monkeypatch, tmp_path):
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(tmp_path))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    monkeypatch.setenv("AIRFLOW_WEBHOOK_SECRET", "secret")
    monkeypatch.setenv("ML_ARTIFACT_STORE", "s3")
    monkeypatch.delenv("ML_ARTIFACT_BUCKET", raising=False)

    with pytest.raises(PipelineConfigurationError, match="ML_ARTIFACT_BUCKET"):
        PipelineRuntimeConfig.from_env()


def test_runtime_config_rejects_missing_backend_base_url(monkeypatch):
    monkeypatch.delenv("PIPELINE_BACKEND_BASE_URL", raising=False)
    monkeypatch.setenv("AIRFLOW_WEBHOOK_SECRET", "secret")

    with pytest.raises(PipelineConfigurationError, match="PIPELINE_BACKEND_BASE_URL"):
        PipelineRuntimeConfig.from_env()


@pytest.mark.parametrize("env_key", ["PIPELINE_ARTIFACT_ROOT", "PIPELINE_BACKEND_BASE_URL"])
def test_runtime_config_rejects_blank_path_and_url_env(monkeypatch, env_key):
    monkeypatch.setenv("AIRFLOW_WEBHOOK_SECRET", "secret")
    if env_key != "PIPELINE_BACKEND_BASE_URL":
        monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    monkeypatch.setenv(env_key, "   ")

    with pytest.raises(PipelineConfigurationError):
        PipelineRuntimeConfig.from_env()


@pytest.mark.parametrize("timeout", ["nan", "inf", "-inf"])
def test_runtime_config_rejects_non_finite_callback_timeout(monkeypatch, timeout):
    monkeypatch.setenv("AIRFLOW_WEBHOOK_SECRET", "secret")
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    monkeypatch.setenv("PIPELINE_CALLBACK_TIMEOUT_SECONDS", timeout)

    with pytest.raises(PipelineConfigurationError):
        PipelineRuntimeConfig.from_env()
