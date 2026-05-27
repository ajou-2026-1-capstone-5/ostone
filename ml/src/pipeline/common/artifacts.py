from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext


def ensure_stage_directory(stage_context: StageContext, runtime_config: PipelineRuntimeConfig) -> Path:
    artifact_dir = stage_context.artifact_dir(runtime_config)
    artifact_dir.mkdir(parents=True, exist_ok=True)
    return artifact_dir


def write_stage_manifest(
    stage_context: StageContext,
    runtime_config: PipelineRuntimeConfig,
    payload: dict[str, Any],
) -> Path:
    artifact_dir = ensure_stage_directory(stage_context, runtime_config)
    manifest_path = artifact_dir / "manifest.json"
    output_refs = _output_refs(payload, artifact_dir)
    payload_checksum = _checksum_json({"payload": payload, "outputArtifactRefs": output_refs})
    manifest = {
        "schemaVersion": "artifact-manifest.v2",
        "stageName": stage_context.stage_name,
        "pipelineJobId": stage_context.pipeline_job_id,
        "datasetId": stage_context.dataset_id,
        "runId": stage_context.run_id,
        "inputArtifactRefs": _artifact_refs(payload.get("upstream_manifest_path")),
        "outputArtifactRefs": output_refs,
        "modelMetadata": {
            "embeddingModel": runtime_config.embedding_model_name,
            "llmModel": runtime_config.llm_model_name,
        },
        "runtimeProfile": runtime_config.runtime_profile,
        "recordCount": _record_count(payload),
        "checksum": payload_checksum,
        "createdAt": datetime.now(UTC).isoformat(),
        "dag_id": stage_context.dag_id,
        "run_id": stage_context.run_id,
        "stage_name": stage_context.stage_name,
        "workspace_id": stage_context.workspace_id,
        "dataset_id": stage_context.dataset_id,
        "pipeline_job_id": stage_context.pipeline_job_id,
        "artifact_root": str(runtime_config.artifact_root),
        "artifact_store": runtime_config.artifact_store,
        "artifact_bucket": runtime_config.artifact_bucket,
        "artifact_prefix": runtime_config.artifact_prefix,
        "config_hash": _config_hash(runtime_config),
        "generated_at": datetime.now(UTC).isoformat(),
        "payload": payload,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest_path


def _checksum_json(payload: object) -> str:
    encoded = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _config_hash(runtime_config: PipelineRuntimeConfig) -> str:
    return _checksum_json(
        {
            "artifact_store": runtime_config.artifact_store,
            "embedding_model_name": runtime_config.embedding_model_name,
            "llm_model_name": runtime_config.llm_model_name,
            "runtime_profile": runtime_config.runtime_profile,
            "gpu_task_mode": runtime_config.gpu_task_mode,
        }
    )


def _artifact_refs(value: object) -> list[dict[str, str]]:
    if isinstance(value, str) and value:
        return [{"type": "manifest", "uri": value}]
    return []


def _output_refs(payload: dict[str, Any], artifact_dir: Path) -> list[dict[str, str]]:
    refs: list[dict[str, str | None]] = []
    for key in (
        "artifact_path",
        "artifactPath",
        "candidateArtifactPath",
        "candidate_artifact_path",
        "embeddings_path",
        "semanticEmbeddingsPath",
        "embeddingIndexPath",
        "flowSignaturesPath",
        "workflowEntryPointsPath",
        "reportPath",
    ):
        value = payload.get(key)
        if isinstance(value, str) and value:
            refs.append({"type": key, "uri": value, "checksum": _file_checksum(value, artifact_dir)})
    return [{k: v for k, v in ref.items() if v is not None} for ref in refs]


def _file_checksum(uri: str, artifact_dir: Path) -> str | None:
    path = Path(uri)
    candidate = path if path.is_absolute() else artifact_dir / path
    if not candidate.exists() or not candidate.is_file():
        return None
    digest = hashlib.sha256()
    with candidate.open("rb") as artifact_file:
        for chunk in iter(lambda: artifact_file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _record_count(payload: dict[str, Any]) -> int | None:
    for key in ("recordCount", "record_count", "conversation_count", "input_count", "embedding_count"):
        value = payload.get(key)
        if isinstance(value, int) and not isinstance(value, bool):
            return value
    metrics = payload.get("metrics")
    if isinstance(metrics, dict):
        for key in ("recordCount", "record_count", "conversation_count", "input_count", "embedding_count"):
            value = metrics.get(key)
            if isinstance(value, int) and not isinstance(value, bool):
                return value
    return None
