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
    assert manifest["runtimeProfile"] == "balanced"
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


def test_stage_manifest_skips_checksum_for_path_outside_stage_dir(tmp_path):
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
    outside = tmp_path / "outside.json"
    outside.write_text('{"ok":true}', encoding="utf-8")

    manifest_path = write_stage_manifest(stage_context, runtime_config, {"artifact_path": str(outside)})

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["outputArtifactRefs"][0] == {
        "type": "artifact_path",
        "uri": str(outside),
    }


@pytest.mark.parametrize("artifact_path", ["../outside.json", "C:\\temp\\artifact.json"])
def test_stage_manifest_skips_checksum_for_unsafe_relative_paths(tmp_path, artifact_path):
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

    manifest_path = write_stage_manifest(stage_context, runtime_config, {"artifact_path": artifact_path})

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["outputArtifactRefs"][0] == {
        "type": "artifact_path",
        "uri": artifact_path,
    }


def test_stage_manifest_skips_remote_artifact_checksum(tmp_path):
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

    manifest_path = write_stage_manifest(stage_context, runtime_config, {"artifact_path": "s3://bucket/path.json"})

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["outputArtifactRefs"][0] == {
        "type": "artifact_path",
        "uri": "s3://bucket/path.json",
    }


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


def test_runtime_config_accepts_s3_artifact_store(monkeypatch, tmp_path):
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

    runtime_config = PipelineRuntimeConfig.from_env()

    assert runtime_config.artifact_store == "s3"
    assert runtime_config.artifact_bucket == "ml-artifacts"
    assert runtime_config.artifact_prefix == "domain-pack/runs"
    assert runtime_config.embedding_model_name == "custom-embedder"
    assert runtime_config.llm_model_name == "custom-llm"
    assert runtime_config.gpu_task_mode == "service"


def test_stage_manifest_mirrors_stage_directory_to_s3(monkeypatch, tmp_path):
    uploaded: list[tuple[str, str, str, dict | None]] = []

    class FakeS3Client:
        def upload_file(self, filename, bucket, key, ExtraArgs=None):
            uploaded.append((filename, bucket, key, ExtraArgs))

    monkeypatch.setattr("pipeline.common.artifacts.boto3.client", lambda _name: FakeS3Client())
    monkeypatch.setenv("S3_EXPECTED_BUCKET_OWNER", "123456789012")
    runtime_config = PipelineRuntimeConfig(
        artifact_root=tmp_path,
        backend_base_url="http://backend:8080",
        callback_enabled=False,
        artifact_store="s3",
        artifact_bucket="ml-artifacts",
        artifact_prefix="/domain-pack/runs/",
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
    (output_dir / "artifact.json").write_text('{"ok":true}', encoding="utf-8")

    write_stage_manifest(stage_context, runtime_config, {"artifact_path": "artifact.json"})

    keys = {item[2] for item in uploaded}
    assert keys == {"domain-pack/runs/dag/run/stage/artifact.json", "domain-pack/runs/dag/run/stage/manifest.json"}
    assert {item[1] for item in uploaded} == {"ml-artifacts"}
    assert all(item[3] == {"ExpectedBucketOwner": "123456789012"} for item in uploaded)


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


@pytest.mark.parametrize("runtime", [" flag_embedding ", " local_http "])
def test_runtime_config_accepts_supported_embedding_runtime_env(monkeypatch, tmp_path, runtime):
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(tmp_path))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    monkeypatch.setenv("AIRFLOW_WEBHOOK_SECRET", "secret")
    monkeypatch.setenv("ML_EMBEDDING_RUNTIME", runtime)

    runtime_config = PipelineRuntimeConfig.from_env()

    assert runtime_config.embedding_runtime == runtime.strip()


def test_runtime_config_rejects_unknown_embedding_runtime(tmp_path):
    with pytest.raises(PipelineConfigurationError, match="ML_EMBEDDING_RUNTIME must be one of"):
        PipelineRuntimeConfig(
            artifact_root=tmp_path,
            backend_base_url="http://backend:8080",
            callback_enabled=False,
            embedding_runtime="external_api",
        )


def test_runtime_config_rejects_removed_embedding_runtime_env(monkeypatch, tmp_path):
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(tmp_path))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    monkeypatch.setenv("AIRFLOW_WEBHOOK_SECRET", "secret")
    monkeypatch.setenv("ML_EMBEDDING_RUNTIME", "hash")

    with pytest.raises(PipelineConfigurationError, match="no longer supports hash/fake/cheap"):
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
