from __future__ import annotations

import json
import logging
import os
import shutil
from collections.abc import Callable, Mapping
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from traceback import format_exc
from typing import Any

from airflow.exceptions import AirflowSkipException
from airflow.sdk import dag, get_current_context, task

from pipeline.common.artifact_io import is_s3_uri, read_json_uri, write_json_uri
from pipeline.common.artifacts import write_stage_manifest
from pipeline.common.callbacks import post_callback
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.dag_defaults import default_dag_args
from pipeline.common.exceptions import PipelineConfigurationError
from pipeline.ecs_stage_task import run_stage_task
from pipeline.ecs_stage_worker import STAGE_MODULES

logger = logging.getLogger(__name__)

RUN_MODE_INITIAL = "INITIAL"
RUN_MODE_DOMAIN_CONFIRMED_REPLAY = "DOMAIN_CONFIRMED_REPLAY"
RUN_MODE_FEEDBACK_REPLAY = "FEEDBACK_REPLAY"
CALLBACK_DOMAIN_CONFIRMATION = "domain-confirmation-checkpoints"
CALLBACK_HUMAN_FEEDBACK = "human-feedback-checkpoints"
CALLBACK_FAILURE = "failures"
STAGE_EXECUTION_MODE_DIRECT = "direct"
STAGE_EXECUTION_MODE_ECS = "ecs"
evaluation_run: Callable[[str], Mapping[str, object] | None] | None = None


def _build_stage_context(stage_name: str) -> StageContext:
    context = get_current_context()
    return StageContext(
        dag_id=context["dag"].dag_id,
        run_id=context["run_id"],
        stage_name=stage_name,
        workspace_id=_context_value(context, "workspace_id"),
        dataset_id=_context_value(context, "dataset_id"),
        pipeline_job_id=_context_value(context, "pipeline_job_id"),
    )


def _context_value(context: Mapping[str, object], key: str) -> str | None:
    dag_run = context.get("dag_run")
    conf = getattr(dag_run, "conf", None)
    if isinstance(conf, Mapping) and conf.get(key) not in (None, ""):
        return str(conf[key])

    params = context.get("params")
    if isinstance(params, Mapping) and params.get(key) not in (None, ""):
        return str(params[key])

    return None


def _run_mode() -> str:
    value = _conf_value("run_mode") or RUN_MODE_INITIAL
    normalized = value.strip().upper()
    if normalized not in {RUN_MODE_INITIAL, RUN_MODE_DOMAIN_CONFIRMED_REPLAY, RUN_MODE_FEEDBACK_REPLAY}:
        raise PipelineConfigurationError(f"Unsupported run_mode: {value}")
    return normalized


def _conf_value(key: str) -> str | None:
    context = get_current_context()
    return _context_value(context, key)


def _conf_bool(key: str, default: bool = False) -> bool:
    value = _conf_value(key)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _conf_json_file(key: str, filename: str) -> str | None:
    value = _conf_value(key)
    if not value:
        return None
    context = get_current_context()
    runtime_config = PipelineRuntimeConfig.from_env()
    dag_id = context["dag"].dag_id
    run_id = context["run_id"].replace("/", "__")
    if _stage_execution_mode() == STAGE_EXECUTION_MODE_ECS:
        if not runtime_config.artifact_bucket:
            raise PipelineConfigurationError("ML_ARTIFACT_BUCKET is required for ECS review input materialization.")
        key_parts = [runtime_config.artifact_prefix, dag_id, run_id, "review_inputs", filename]
        uri = f"s3://{runtime_config.artifact_bucket}/{'/'.join(part.strip('/') for part in key_parts if part)}"
        try:
            payload = json.loads(value)
        except json.JSONDecodeError as exc:
            raise PipelineConfigurationError(f"{key} must be valid JSON.") from exc
        write_json_uri(uri, payload)
        return uri
    input_dir = runtime_config.artifact_root / dag_id / run_id / "review_inputs"
    input_dir.mkdir(parents=True, exist_ok=True)
    path = input_dir / filename
    path.write_text(value, encoding="utf-8")
    return str(path.resolve())


def _stage_execution_mode() -> str:
    value = os.getenv("PIPELINE_STAGE_EXECUTION_MODE", STAGE_EXECUTION_MODE_DIRECT).strip().lower()
    if value not in {STAGE_EXECUTION_MODE_DIRECT, STAGE_EXECUTION_MODE_ECS}:
        raise PipelineConfigurationError("PIPELINE_STAGE_EXECUTION_MODE must be one of: direct, ecs.")
    return value


def _run_stage(
    stage_name: str,
    stage_callable: Callable[[str | None], Mapping[str, object] | None] | None = None,
    upstream_manifest_path: str | None = None,
) -> dict[str, str]:
    stage_context = _build_stage_context(stage_name)
    runtime_config = PipelineRuntimeConfig.from_env()
    if _stage_execution_mode() == STAGE_EXECUTION_MODE_ECS:
        return run_stage_task(stage_name, stage_context, runtime_config, upstream_manifest_path)
    if stage_callable is None:
        stage_callable = _stage_callable(stage_name)
    manifest_payload: dict[str, object] = {
        "backend_base_url": runtime_config.backend_base_url,
        "upstream_manifest_path": upstream_manifest_path,
    }
    try:
        stage_result = stage_callable(upstream_manifest_path)
    except Exception as exc:
        manifest_payload.update(_manifest_payload_from_exception(exc))
        manifest_payload["status"] = "failed"
        manifest_payload["error"] = {
            "type": type(exc).__name__,
            "message": str(exc),
            "traceback": format_exc(),
        }
        try:
            write_stage_manifest(stage_context, runtime_config, manifest_payload)
        except Exception:
            logger.exception("Failed to write failure manifest for stage '%s'", stage_name)
        raise
    else:
        if stage_result is not None:
            artifact_manifest_path = _artifact_manifest_path_from(stage_result)
            if artifact_manifest_path is not None:
                return {"artifact_manifest_path": artifact_manifest_path}
            manifest_payload.update(stage_result)
        manifest_payload["status"] = "completed"
        manifest_path: Path = write_stage_manifest(stage_context, runtime_config, manifest_payload)
    return {"artifact_manifest_path": str(manifest_path)}


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


def _passthrough_manifest_from_conf() -> dict[str, str]:
    upstream_manifest_path = _conf_value("upstream_manifest_path")
    if not upstream_manifest_path:
        raise PipelineConfigurationError("Replay run requires upstream_manifest_path.")
    runtime_config = PipelineRuntimeConfig.from_env()
    validated_manifest_path = _validated_replay_manifest_path(upstream_manifest_path, runtime_config)
    if isinstance(validated_manifest_path, str):
        return {"artifact_manifest_path": validated_manifest_path}
    return _materialize_replay_manifest(validated_manifest_path)


def _validated_replay_manifest_path(
    upstream_manifest_path: str,
    runtime_config: PipelineRuntimeConfig,
) -> Path | str:
    if is_s3_uri(upstream_manifest_path):
        return _validated_replay_manifest_s3_uri(upstream_manifest_path, runtime_config)
    resolved = Path(upstream_manifest_path).expanduser().resolve()
    artifact_root = runtime_config.artifact_root.expanduser().resolve()
    try:
        resolved.relative_to(artifact_root)
    except ValueError as exc:
        raise PipelineConfigurationError("upstream_manifest_path must be under PIPELINE_ARTIFACT_ROOT.") from exc
    if resolved.name != "manifest.json":
        raise PipelineConfigurationError("upstream_manifest_path must point to a manifest.json file.")
    return resolved


def _validated_replay_manifest_s3_uri(
    upstream_manifest_path: str,
    runtime_config: PipelineRuntimeConfig,
) -> str:
    if runtime_config.artifact_store != "s3":
        raise PipelineConfigurationError("S3 upstream_manifest_path requires ML_ARTIFACT_STORE=s3.")
    if not upstream_manifest_path.endswith("/manifest.json"):
        raise PipelineConfigurationError("upstream_manifest_path must point to a manifest.json file.")
    if runtime_config.artifact_bucket and not upstream_manifest_path.startswith(f"s3://{runtime_config.artifact_bucket}/"):
        raise PipelineConfigurationError("upstream_manifest_path must be under ML_ARTIFACT_BUCKET.")
    return upstream_manifest_path


def _materialize_replay_manifest(upstream_manifest_path: Path) -> dict[str, str]:
    context = get_current_context()
    stage_context = StageContext(
        dag_id=context["dag"].dag_id,
        run_id=context["run_id"],
        stage_name="representation",
        workspace_id=_context_value(context, "workspace_id"),
        dataset_id=_context_value(context, "dataset_id"),
        pipeline_job_id=_context_value(context, "pipeline_job_id"),
    )
    runtime_config = PipelineRuntimeConfig.from_env()
    upstream_manifest = _load_manifest(upstream_manifest_path)
    source_representation_dir = upstream_manifest_path.parent
    source_preprocessing_dir = source_representation_dir.parent / "preprocessing"
    target_representation_dir = stage_context.artifact_dir(runtime_config)
    target_preprocessing_dir = target_representation_dir.parent / "preprocessing"
    _copy_directory(source_preprocessing_dir, target_preprocessing_dir)
    _copy_directory(source_representation_dir, target_representation_dir)
    upstream_payload = upstream_manifest.get("payload")
    manifest_payload = dict(upstream_payload if isinstance(upstream_payload, dict) else {})
    manifest_payload["upstream_manifest_path"] = str(upstream_manifest_path)
    manifest_path = write_stage_manifest(stage_context, runtime_config, manifest_payload)
    return {"artifact_manifest_path": str(manifest_path.resolve())}


def _copy_directory(source: Path, target: Path) -> None:
    if not source.exists() or not source.is_dir():
        raise PipelineConfigurationError(f"Replay source artifact directory does not exist: {source}")
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(source, target)


@contextmanager
def _stage_env(overrides: Mapping[str, str | None]):
    previous: dict[str, str | None] = {}
    for key, value in overrides.items():
        previous[key] = os.environ.get(key)
        if value is None or value == "":
            os.environ.pop(key, None)
        else:
            os.environ[key] = value
    try:
        yield
    finally:
        for key, value in previous.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


def _post_checkpoint_callback(
    *,
    stage_name: str,
    callback_type: str,
    upstream_manifest_path: str,
    artifact_payload_key: str,
    artifact_path_key: str,
) -> dict[str, str]:
    stage_context = _build_stage_context(stage_name)
    runtime_config = PipelineRuntimeConfig.from_env()
    if not runtime_config.callback_enabled:
        raise PipelineConfigurationError(f"{stage_name} requires PIPELINE_CALLBACK_ENABLED=true.")
    manifest = _load_manifest_uri(upstream_manifest_path)
    payload = manifest.get("payload")
    if not isinstance(payload, dict):
        raise PipelineConfigurationError(f"{stage_name} upstream manifest payload must be an object.")
    artifact_name = payload.get(artifact_path_key)
    if not isinstance(artifact_name, str) or not artifact_name:
        raise PipelineConfigurationError(f"{stage_name} upstream manifest missing {artifact_path_key}.")
    resolved_artifact_path = _resolve_artifact_uri(upstream_manifest_path, artifact_name)
    artifact_payload = _load_manifest_uri(resolved_artifact_path)
    response = post_callback(
        runtime_config.backend_base_url,
        _require_pipeline_job_id(stage_context.pipeline_job_id),
        callback_type,
        {
            "externalEventId": _external_event_id(stage_context, callback_type),
            "dagId": stage_context.dag_id,
            "dagRunId": stage_context.run_id,
            "runMode": _run_mode(),
            "parentPipelineJobId": _conf_value("parent_pipeline_job_id"),
            "upstreamManifestPath": str(_representation_manifest_path(stage_context, runtime_config)),
            artifact_path_key: resolved_artifact_path,
            artifact_payload_key: artifact_payload,
        },
        runtime_config.airflow_webhook_secret or "",
        runtime_config.callback_timeout_seconds,
    )
    if response.http_status >= 300:
        raise PipelineConfigurationError(f"{stage_name} callback failed with HTTP {response.http_status}.")
    return {"artifact_manifest_path": upstream_manifest_path}


def _load_manifest(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise PipelineConfigurationError(f"JSON payload must be an object: {path}")
    return payload


def _load_manifest_uri(uri: str) -> dict[str, Any]:
    return read_json_uri(uri) if is_s3_uri(uri) else _load_manifest(Path(uri))


def _resolve_artifact_uri(manifest_uri: str, artifact_name: str) -> str:
    if is_s3_uri(manifest_uri):
        return f"{manifest_uri.rsplit('/', 1)[0]}/{artifact_name.lstrip('/')}"
    artifact_path = Path(artifact_name)
    return str(artifact_path if artifact_path.is_absolute() else Path(manifest_uri).parent / artifact_path)


def _representation_manifest_path(stage_context: StageContext, runtime_config: PipelineRuntimeConfig) -> str:
    representation_context = StageContext(
        dag_id=stage_context.dag_id,
        run_id=stage_context.run_id,
        stage_name="representation",
        workspace_id=stage_context.workspace_id,
        dataset_id=stage_context.dataset_id,
        pipeline_job_id=stage_context.pipeline_job_id,
    )
    if runtime_config.artifact_store == "s3":
        from pipeline.common.artifact_io import stage_manifest_s3_uri

        return stage_manifest_s3_uri(representation_context, runtime_config)
    return str(representation_context.artifact_dir(runtime_config) / "manifest.json")


def _external_event_id(stage_context: object, callback_type: str) -> str:
    return f"{getattr(stage_context, 'dag_id')}:{getattr(stage_context, 'run_id')}:{callback_type}"


def _require_pipeline_job_id(value: str | None) -> str:
    if not value:
        raise PipelineConfigurationError("pipeline_job_id is required for checkpoint callback.")
    return value


def _notify_failure_callback(context: Mapping[str, object]) -> None:
    try:
        runtime_config = PipelineRuntimeConfig.from_env()
        if not runtime_config.callback_enabled:
            return
        pipeline_job_id = _context_value(context, "pipeline_job_id")
        if not pipeline_job_id:
            logger.warning("Skip failure callback because pipeline_job_id is missing.")
            return
        dag = context.get("dag")
        dag_run = context.get("dag_run")
        task_instance = context.get("task_instance")
        exception = context.get("exception")
        dag_id = str(getattr(dag, "dag_id", "") or _context_value(context, "dag_id") or "")
        dag_run_id = str(getattr(dag_run, "run_id", "") or context.get("run_id") or "")
        failed_stage = str(getattr(task_instance, "task_id", "") or "unknown")
        reason = type(exception).__name__ if exception is not None else "TaskFailed"
        message = str(exception).strip() if exception is not None else "Airflow task failed."
        post_callback(
            runtime_config.backend_base_url,
            pipeline_job_id,
            CALLBACK_FAILURE,
            {
                "externalEventId": _failure_external_event_id(dag_id, dag_run_id, failed_stage),
                "dagId": dag_id,
                "dagRunId": dag_run_id,
                "failedStage": failed_stage,
                "reason": reason[:100] or "TaskFailed",
                "message": message[:5000] or "Airflow task failed.",
                "occurredAt": datetime.now(timezone.utc).isoformat(),
                "error": {
                    "type": reason,
                    "message": message,
                },
            },
            runtime_config.airflow_webhook_secret or "",
            runtime_config.callback_timeout_seconds,
        )
    except Exception:
        logger.exception("Failed to send pipeline failure callback.")


def _failure_external_event_id(dag_id: str, dag_run_id: str, failed_stage: str) -> str:
    value = f"{dag_id}:{dag_run_id}:{failed_stage}:{CALLBACK_FAILURE}"
    if len(value) <= 255:
        return value
    return f"{dag_id[:48]}:{dag_run_id[:120]}:{failed_stage[:48]}:{CALLBACK_FAILURE}"


def _run_evaluation_stage(upstream_manifest_path: str | None) -> Mapping[str, object] | None:
    if upstream_manifest_path is None:
        raise PipelineConfigurationError("evaluation stage requires an upstream manifest path.")
    evaluation_run = globals().get("evaluation_run")
    run = evaluation_run if callable(evaluation_run) else _stage_callable("evaluation")
    return run(upstream_manifest_path)


def _stage_callable(stage_name: str) -> Callable[[str | None], Mapping[str, object] | None]:
    module_name = STAGE_MODULES.get(stage_name)
    if module_name is None:
        raise PipelineConfigurationError(f"Unsupported pipeline stage: {stage_name}")
    from importlib import import_module

    run = getattr(import_module(module_name), "run", None)
    if not callable(run):
        raise PipelineConfigurationError(f"Stage module does not expose run(): {module_name}")
    return run


@dag(
    dag_id="domain_pack_generation",
    schedule=None,
    start_date=datetime(2024, 1, 1),
    catchup=False,
    default_args=default_dag_args(),
    dagrun_timeout=timedelta(hours=2),
    max_active_runs=int(os.getenv("PIPELINE_DAG_MAX_ACTIVE_RUNS", "4")),
    max_active_tasks=int(os.getenv("PIPELINE_DAG_MAX_ACTIVE_TASKS", "1")),
    on_failure_callback=_notify_failure_callback,
    params={
        "workspace_id": "local-workspace",
        "dataset_id": "local-dataset",
        "pipeline_job_id": "local-pipeline-job",
        "object_key": "",
    },
    tags=["pipeline", "domain-pack"],
)
def domain_pack_generation() -> None:  # pragma: no cover - Airflow imports this DAG; stage helpers are unit-tested.
    @task(task_id="ingestion")
    def ingestion() -> dict[str, str]:
        if _run_mode() != RUN_MODE_INITIAL:
            return _passthrough_manifest_from_conf()
        return _run_stage("ingestion")

    @task(task_id="preprocessing")
    def preprocessing(ingestion_result: dict[str, str]) -> dict[str, str]:
        if _run_mode() != RUN_MODE_INITIAL:
            return ingestion_result
        return _run_stage(
            "preprocessing",
            upstream_manifest_path=ingestion_result["artifact_manifest_path"],
        )

    @task(task_id="intent_discovery")
    def intent_discovery(representation_result: dict[str, str]) -> dict[str, str]:
        if _run_mode() == RUN_MODE_INITIAL:
            raise AirflowSkipException("Initial run stops after domain confirmation checkpoint.")
        with _stage_env(
            {
                "PIPELINE_CONFIRMED_DOMAIN_PROFILE_PATH": _conf_value("confirmed_domain_profile_path")
                or _conf_json_file("confirmed_domain_profile_json", "confirmed_domain_profile.json"),
                "PIPELINE_FEEDBACK_CONSTRAINTS_PATH": _conf_value("feedback_constraints_path")
                or _conf_json_file("feedback_constraints_json", "feedback_constraints.json"),
            }
        ):
            return _run_stage(
                "intent_discovery",
                upstream_manifest_path=representation_result["artifact_manifest_path"],
            )

    @task(task_id="domain_candidate_generation")
    def domain_candidate_generation(representation_result: dict[str, str]) -> dict[str, str]:
        if _run_mode() != RUN_MODE_INITIAL:
            return representation_result
        return _run_stage(
            "domain_candidate_generation",
            upstream_manifest_path=representation_result["artifact_manifest_path"],
        )

    @task(task_id="domain_confirmation_checkpoint")
    def domain_confirmation_checkpoint(domain_candidate_result: dict[str, str]) -> dict[str, str]:
        if _run_mode() != RUN_MODE_INITIAL:
            return domain_candidate_result
        return _post_checkpoint_callback(
            stage_name="domain_confirmation_checkpoint",
            callback_type=CALLBACK_DOMAIN_CONFIRMATION,
            upstream_manifest_path=domain_candidate_result["artifact_manifest_path"],
            artifact_payload_key="domainCandidates",
            artifact_path_key="domainCandidatesPath",
        )

    @task(task_id="representation")
    def representation(preprocessing_result: dict[str, str]) -> dict[str, str]:
        if _run_mode() != RUN_MODE_INITIAL:
            return preprocessing_result
        return _run_stage(
            "representation",
            upstream_manifest_path=preprocessing_result["artifact_manifest_path"],
        )

    @task(task_id="flow_splitting")
    def flow_splitting(intent_discovery_result: dict[str, str]) -> dict[str, str]:
        return _run_stage(
            "flow_splitting",
            upstream_manifest_path=intent_discovery_result["artifact_manifest_path"],
        )

    @task(task_id="feedback_candidate_generation")
    def feedback_candidate_generation(flow_splitting_result: dict[str, str]) -> dict[str, str]:
        if _conf_bool("skip_feedback_checkpoint") or _run_mode() == RUN_MODE_FEEDBACK_REPLAY:
            return flow_splitting_result
        return _run_stage(
            "feedback_candidate_generation",
            upstream_manifest_path=flow_splitting_result["artifact_manifest_path"],
        )

    @task(task_id="human_feedback_checkpoint")
    def human_feedback_checkpoint(feedback_candidate_result: dict[str, str]) -> dict[str, str]:
        if _conf_bool("skip_feedback_checkpoint") or _run_mode() == RUN_MODE_FEEDBACK_REPLAY:
            return feedback_candidate_result
        _post_checkpoint_callback(
            stage_name="human_feedback_checkpoint",
            callback_type=CALLBACK_HUMAN_FEEDBACK,
            upstream_manifest_path=feedback_candidate_result["artifact_manifest_path"],
            artifact_payload_key="feedbackQuestions",
            artifact_path_key="feedbackQuestionsPath",
        )
        raise AirflowSkipException("Domain-confirmed replay stops after human feedback checkpoint.")

    @task(task_id="draft_generation")
    def draft_generation(human_feedback_result: dict[str, str]) -> dict[str, str]:
        return _run_stage(
            "draft_generation",
            upstream_manifest_path=human_feedback_result["artifact_manifest_path"],
        )

    @task(task_id="evaluation")
    def evaluation(draft_generation_result: dict[str, str]) -> dict[str, str]:
        return _run_stage(
            "evaluation",
            _run_evaluation_stage,
            draft_generation_result["artifact_manifest_path"],
        )

    @task(task_id="publish_candidate")
    def publish_candidate(evaluation_result: dict[str, str]) -> dict[str, str]:
        return _run_stage(
            "publish_candidate",
            upstream_manifest_path=evaluation_result["artifact_manifest_path"],
        )

    ingestion_task = ingestion()
    preprocessing_task = preprocessing(ingestion_task)
    representation_task = representation(preprocessing_task)
    domain_candidate_task = domain_candidate_generation(representation_task)
    domain_confirmation_task = domain_confirmation_checkpoint(domain_candidate_task)
    intent_discovery_task = intent_discovery(domain_confirmation_task)
    flow_splitting_task = flow_splitting(intent_discovery_task)
    feedback_candidate_task = feedback_candidate_generation(flow_splitting_task)
    human_feedback_task = human_feedback_checkpoint(feedback_candidate_task)
    draft_generation_task = draft_generation(human_feedback_task)
    evaluation_task = evaluation(draft_generation_task)
    publish_candidate_task = publish_candidate(evaluation_task)

    ingestion_task >> preprocessing_task >> representation_task >> domain_candidate_task >> domain_confirmation_task
    domain_confirmation_task >> intent_discovery_task >> flow_splitting_task >> feedback_candidate_task
    feedback_candidate_task >> human_feedback_task >> draft_generation_task
    draft_generation_task >> evaluation_task >> publish_candidate_task


domain_pack_generation()
