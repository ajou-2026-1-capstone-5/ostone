from __future__ import annotations

import logging
import os
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from pathlib import Path
from traceback import format_exc

from pipeline.common.artifacts import write_stage_manifest
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineConfigurationError
from pipeline.ecs_stage_task import run_stage_task

logger = logging.getLogger(__name__)

STAGE_EXECUTION_MODE_DIRECT = "direct"
STAGE_EXECUTION_MODE_ECS = "ecs"
SUPPORTED_STAGE_EXECUTION_MODES = {STAGE_EXECUTION_MODE_DIRECT, STAGE_EXECUTION_MODE_ECS}
StageCallable = Callable[[str | None], Mapping[str, object] | None]
StageXComPayload = dict[str, str]


@dataclass(frozen=True)
class StageRunRequest:
    stage_name: str
    stage_context: StageContext
    runtime_config: PipelineRuntimeConfig
    upstream_manifest_path: str | None = None
    stage_callable: StageCallable | None = None
    raw_object_key: str | None = None


class DirectStageRunner:
    def run(self, request: StageRunRequest) -> StageXComPayload:
        if request.stage_callable is None:
            raise PipelineConfigurationError(f"{request.stage_name} requires a direct stage callable.")

        manifest_payload: dict[str, object] = {
            "backend_base_url": request.runtime_config.backend_base_url,
            "upstream_manifest_path": request.upstream_manifest_path,
        }
        try:
            stage_result = request.stage_callable(request.upstream_manifest_path)
        except Exception as exc:
            manifest_payload.update(_manifest_payload_from_exception(exc))
            manifest_payload["status"] = "failed"
            manifest_payload["error"] = {
                "type": type(exc).__name__,
                "message": str(exc),
                "traceback": format_exc(),
            }
            try:
                write_stage_manifest(request.stage_context, request.runtime_config, manifest_payload)
            except Exception:
                logger.exception("Failed to write failure manifest for stage '%s'", request.stage_name)
            raise

        if stage_result is not None:
            artifact_manifest_path = _artifact_manifest_path_from(stage_result)
            if artifact_manifest_path is not None:
                return stage_xcom_payload(artifact_manifest_path)
            manifest_payload.update(stage_result)
        manifest_payload["status"] = "completed"
        manifest_path: Path = write_stage_manifest(request.stage_context, request.runtime_config, manifest_payload)
        return stage_xcom_payload(str(manifest_path))


class EcsStageRunner:
    def run(self, request: StageRunRequest) -> StageXComPayload:
        return run_stage_task(
            request.stage_name,
            request.stage_context,
            request.runtime_config,
            request.upstream_manifest_path,
            raw_object_key=request.raw_object_key,
        )


def stage_execution_mode_from_env() -> str:
    value = os.getenv("PIPELINE_STAGE_EXECUTION_MODE", STAGE_EXECUTION_MODE_DIRECT).strip().lower()
    if value not in SUPPORTED_STAGE_EXECUTION_MODES:
        raise PipelineConfigurationError("PIPELINE_STAGE_EXECUTION_MODE must be one of: direct, ecs.")
    return value


def create_stage_runner(execution_mode: str | None = None) -> DirectStageRunner | EcsStageRunner:
    mode = stage_execution_mode_from_env() if execution_mode is None else execution_mode.strip().lower()
    if mode == STAGE_EXECUTION_MODE_DIRECT:
        return DirectStageRunner()
    if mode == STAGE_EXECUTION_MODE_ECS:
        return EcsStageRunner()
    raise PipelineConfigurationError("PIPELINE_STAGE_EXECUTION_MODE must be one of: direct, ecs.")


def stage_xcom_payload(artifact_manifest_path: str) -> StageXComPayload:
    if not artifact_manifest_path:
        raise PipelineConfigurationError("stage runner must return a non-empty artifact_manifest_path.")
    return {"artifact_manifest_path": artifact_manifest_path}


def _manifest_payload_from_exception(exc: BaseException) -> dict[str, object]:
    manifest_payload = getattr(exc, "manifest_payload", None)
    if isinstance(manifest_payload, Mapping):
        return dict(manifest_payload)
    return {}


def _artifact_manifest_path_from(stage_result: Mapping[str, object]) -> str | None:
    artifact_manifest_path = stage_result.get("artifact_manifest_path")
    if isinstance(artifact_manifest_path, str) and artifact_manifest_path:
        return artifact_manifest_path
    return None
