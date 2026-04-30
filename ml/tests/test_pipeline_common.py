import pytest

from pipeline.common.artifacts import write_stage_manifest
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineConfigurationError


def test_should_write_stage_manifest(tmp_path):
    runtime_config = PipelineRuntimeConfig(
        artifact_root=tmp_path,
        backend_base_url="http://backend:8080",
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
    assert '"stage_name": "bootstrap_smoke"' in manifest_path.read_text(encoding="utf-8")


def test_runtime_config_rejects_blank_callback_secret(monkeypatch):
    monkeypatch.setenv("AIRFLOW_WEBHOOK_SECRET", "   ")

    with pytest.raises(PipelineConfigurationError):
        PipelineRuntimeConfig.from_env()


def test_runtime_config_strips_artifact_root_and_backend_base_url(monkeypatch, tmp_path):
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", f"  {tmp_path}  ")
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "  http://backend:8080/  ")
    monkeypatch.setenv("AIRFLOW_WEBHOOK_SECRET", "secret")

    runtime_config = PipelineRuntimeConfig.from_env()

    assert runtime_config.artifact_root == tmp_path
    assert runtime_config.backend_base_url == "http://backend:8080"


@pytest.mark.parametrize("env_key", ["PIPELINE_ARTIFACT_ROOT", "PIPELINE_BACKEND_BASE_URL"])
def test_runtime_config_rejects_blank_path_and_url_env(monkeypatch, env_key):
    monkeypatch.setenv("AIRFLOW_WEBHOOK_SECRET", "secret")
    monkeypatch.setenv(env_key, "   ")

    with pytest.raises(PipelineConfigurationError):
        PipelineRuntimeConfig.from_env()


@pytest.mark.parametrize("timeout", ["nan", "inf", "-inf"])
def test_runtime_config_rejects_non_finite_callback_timeout(monkeypatch, timeout):
    monkeypatch.setenv("AIRFLOW_WEBHOOK_SECRET", "secret")
    monkeypatch.setenv("PIPELINE_CALLBACK_TIMEOUT_SECONDS", timeout)

    with pytest.raises(PipelineConfigurationError):
        PipelineRuntimeConfig.from_env()
