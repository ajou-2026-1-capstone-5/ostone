from __future__ import annotations

import logging
from collections.abc import Callable, Mapping
from datetime import datetime, timedelta
from pathlib import Path
from traceback import format_exc

from airflow.sdk import dag, get_current_context, task

from pipeline.common.artifacts import write_stage_manifest
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.dag_defaults import default_dag_args
from pipeline.common.exceptions import PipelineConfigurationError
from pipeline.stages.draft_generation.main import run as draft_generation_run
from pipeline.stages.evaluation.main import run as evaluation_run
from pipeline.stages.ingestion.main import run as ingestion_run
from pipeline.stages.intent_discovery.main import run as intent_discovery_run
from pipeline.stages.preprocessing.main import run as preprocessing_run
from pipeline.stages.publish_candidate.main import run as publish_candidate_run

logger = logging.getLogger(__name__)


def _build_stage_context(stage_name: str) -> StageContext:
    context = get_current_context()
    return StageContext(
        dag_id=context["dag"].dag_id,
        run_id=context["run_id"],
        stage_name=stage_name,
        workspace_id=context["params"].get("workspace_id"),
        dataset_id=context["params"].get("dataset_id"),
        pipeline_job_id=context["params"].get("pipeline_job_id"),
    )


def _run_stage(
    stage_name: str,
    stage_callable: Callable[[str | None], Mapping[str, object] | None],
    upstream_manifest_path: str | None = None,
) -> dict[str, str]:
    stage_context = _build_stage_context(stage_name)
    runtime_config = PipelineRuntimeConfig.from_env()
    manifest_payload: dict[str, object] = {
        "backend_base_url": runtime_config.backend_base_url,
        "upstream_manifest_path": upstream_manifest_path,
    }
    try:
        stage_result = stage_callable(upstream_manifest_path)
    except Exception as exc:
        stage_manifest_payload = getattr(exc, "manifest_payload", None)
        if isinstance(stage_manifest_payload, dict):
            manifest_payload.update(stage_manifest_payload)
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
            artifact_manifest_path = stage_result.get("artifact_manifest_path")
            if isinstance(artifact_manifest_path, str):
                return {"artifact_manifest_path": artifact_manifest_path}
            manifest_payload.update(stage_result)
        manifest_payload["status"] = "completed"
        manifest_path: Path = write_stage_manifest(stage_context, runtime_config, manifest_payload)
    return {"artifact_manifest_path": str(manifest_path)}


def _run_evaluation_stage(upstream_manifest_path: str | None) -> Mapping[str, object] | None:
    if upstream_manifest_path is None:
        raise PipelineConfigurationError("evaluation stage requires an upstream manifest path.")
    return evaluation_run(upstream_manifest_path)


@dag(
    dag_id="domain_pack_generation",
    schedule=None,
    start_date=datetime(2024, 1, 1),
    catchup=False,
    default_args=default_dag_args(),
    dagrun_timeout=timedelta(hours=2),
    max_active_runs=1,
    params={
        "workspace_id": "local-workspace",
        "dataset_id": "local-dataset",
        "pipeline_job_id": "local-pipeline-job",
    },
    tags=["pipeline", "domain-pack"],
)
def domain_pack_generation() -> None:
    @task(task_id="ingestion")
    def ingestion() -> dict[str, str]:
        return _run_stage("ingestion", ingestion_run)

    @task(task_id="preprocessing")
    def preprocessing(ingestion_result: dict[str, str]) -> dict[str, str]:
        return _run_stage(
            "preprocessing",
            preprocessing_run,
            ingestion_result["artifact_manifest_path"],
        )

    @task(task_id="intent_discovery")
    def intent_discovery(preprocessing_result: dict[str, str]) -> dict[str, str]:
        return _run_stage(
            "intent_discovery",
            intent_discovery_run,
            preprocessing_result["artifact_manifest_path"],
        )

    @task(task_id="draft_generation")
    def draft_generation(intent_discovery_result: dict[str, str]) -> dict[str, str]:
        return _run_stage(
            "draft_generation",
            draft_generation_run,
            intent_discovery_result["artifact_manifest_path"],
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
            publish_candidate_run,
            evaluation_result["artifact_manifest_path"],
        )

    ingestion_task = ingestion()
    preprocessing_task = preprocessing(ingestion_task)
    intent_discovery_task = intent_discovery(preprocessing_task)
    draft_generation_task = draft_generation(intent_discovery_task)
    evaluation_task = evaluation(draft_generation_task)
    publish_candidate_task = publish_candidate(evaluation_task)

    ingestion_task >> preprocessing_task >> intent_discovery_task >> draft_generation_task
    draft_generation_task >> evaluation_task >> publish_candidate_task


domain_pack_generation()
