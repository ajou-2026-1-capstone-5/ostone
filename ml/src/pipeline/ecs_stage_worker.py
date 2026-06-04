"""ECS one-shot worker that executes a single ML pipeline stage."""

from __future__ import annotations

import importlib
import logging
import os
import sys
import tempfile
from pathlib import Path
from typing import Any, Callable

from pipeline.common.artifact_io import (
    download_s3_uri,
    is_s3_uri,
    manifest_s3_uri_from_local_manifest,
    materialize_manifest_uri,
    write_json_uri,
)
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.exceptions import PipelineConfigurationError

logger = logging.getLogger(__name__)

StageCallable = Callable[[str | None], dict[str, object] | None]

STAGE_MODULES: dict[str, str] = {
    "ingestion": "pipeline.stages.ingestion.main",
    "preprocessing": "pipeline.stages.preprocessing.main",
    "representation": "pipeline.stages.representation.main",
    "domain_candidate_generation": "pipeline.stages.domain_candidate_generation.main",
    "intent_discovery": "pipeline.stages.intent_discovery.main",
    "flow_splitting": "pipeline.stages.flow_splitting.main",
    "feedback_candidate_generation": "pipeline.stages.feedback_candidate_generation.main",
    "draft_generation": "pipeline.stages.draft_generation.main",
    "evaluation": "pipeline.stages.evaluation.main",
    "publish_candidate": "pipeline.stages.publish_candidate.main",
}


class StageWorkerError(RuntimeError):
    """Raised when a one-shot stage worker cannot complete."""


def run_worker() -> dict[str, Any]:
    stage_name = _required_env("PIPELINE_STAGE_NAME")
    result_uri = _required_env("PIPELINE_STAGE_RESULT_URI")
    scratch_root = _scratch_root()
    artifact_root = scratch_root / "artifacts"
    artifact_root.mkdir(parents=True, exist_ok=True)
    os.environ["PIPELINE_ARTIFACT_ROOT"] = str(artifact_root)
    runtime_config = PipelineRuntimeConfig.from_env()

    upstream_manifest = _optional_env("PIPELINE_UPSTREAM_MANIFEST_URI")
    local_upstream = None
    if upstream_manifest:
        local_upstream = str(materialize_manifest_uri(upstream_manifest, artifact_root, runtime_config))
    _materialize_optional_file_env("PIPELINE_CONFIRMED_DOMAIN_PROFILE_PATH", scratch_root / "review_inputs")
    _materialize_optional_file_env("PIPELINE_FEEDBACK_CONSTRAINTS_PATH", scratch_root / "review_inputs")

    stage_callable = _stage_callable(stage_name)
    logger.info("Running stage=%s upstream=%s", stage_name, upstream_manifest or "")
    result = stage_callable(local_upstream) or {}
    local_manifest_path = _artifact_manifest_path(result)
    manifest_uri = (
        manifest_s3_uri_from_local_manifest(local_manifest_path, allowed_root=artifact_root)
        if runtime_config.artifact_store == "s3" or is_s3_uri(upstream_manifest)
        else str(local_manifest_path)
    )
    payload = {
        "stageName": stage_name,
        "artifact_manifest_path": manifest_uri,
        "manifestUri": manifest_uri,
        "localManifestPath": str(local_manifest_path),
    }
    write_json_uri(result_uri, payload)
    logger.info("Stage completed stage=%s manifest=%s", stage_name, manifest_uri)
    return payload


def _stage_callable(stage_name: str) -> StageCallable:
    module_name = STAGE_MODULES.get(stage_name)
    if module_name is None:
        allowed = ", ".join(sorted(STAGE_MODULES))
        raise StageWorkerError(f"Unsupported PIPELINE_STAGE_NAME: {stage_name}. allowed={allowed}")
    module = importlib.import_module(module_name)
    run = getattr(module, "run", None)
    if not callable(run):
        raise StageWorkerError(f"Stage module does not expose a callable run(): {module_name}")
    return run


def _artifact_manifest_path(result: dict[str, object]) -> Path:
    value = result.get("artifact_manifest_path")
    if not isinstance(value, str) or not value:
        raise StageWorkerError("Stage result must include artifact_manifest_path.")
    return Path(value)


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise StageWorkerError(f"{name} is required")
    return value


def _scratch_root() -> Path:
    configured = os.getenv("PIPELINE_STAGE_SCRATCH_ROOT", "").strip()
    if configured:
        return Path(configured)
    return Path(tempfile.mkdtemp(prefix="ostone-stage-worker-"))


def _optional_env(name: str) -> str | None:
    value = os.getenv(name, "").strip()
    return value or None


def _materialize_optional_file_env(name: str, target_dir: Path) -> None:
    value = _optional_env(name)
    if value is None or not is_s3_uri(value):
        return
    target_path = target_dir / Path(value.rsplit("/", 1)[-1]).name
    download_s3_uri(value, target_path)
    os.environ[name] = str(target_path)


def main() -> None:
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
    try:
        run_worker()
    except (PipelineConfigurationError, StageWorkerError) as exc:
        _write_failure_result(exc)
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
    except Exception as exc:
        logger.exception("Stage worker failed")
        _write_failure_result(exc)
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
    sys.exit(0)


def _write_failure_result(exc: BaseException) -> None:
    result_uri = os.getenv("PIPELINE_STAGE_RESULT_URI", "").strip()
    if not result_uri:
        return
    stage_name = os.getenv("PIPELINE_STAGE_NAME", "").strip() or "unknown"
    try:
        write_json_uri(
            result_uri,
            {
                "stageName": stage_name,
                "status": "failed",
                "error": {
                    "type": type(exc).__name__,
                    "message": str(exc),
                },
            },
        )
    except Exception:
        logger.exception("Failed to write ECS stage failure result.")


if __name__ == "__main__":
    main()
