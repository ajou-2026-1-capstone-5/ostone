from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta
from pathlib import Path
from traceback import format_exc

from airflow.sdk import dag, get_current_context, task

from pipeline.common.artifacts import write_stage_manifest
from pipeline.common.dag_defaults import DEFAULT_DAG_ARGS
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.stages.draft_generation.main import run as draft_generation_run
from pipeline.stages.evaluation.main import run as evaluation_run
from pipeline.stages.ingestion.main import run as ingestion_run
from pipeline.stages.intent_discovery.main import run as intent_discovery_run
from pipeline.stages.preprocessing.main import run as preprocessing_run
from pipeline.stages.publish_candidate.main import run as publish_candidate_run


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


def _run_stage(stage_name: str, stage_callable: Callable[[], None]) -> dict[str, str]:
    stage_context = _build_stage_context(stage_name)
    runtime_config = PipelineRuntimeConfig.from_env()
    manifest_payload: dict[str, object] = {"backend_base_url": runtime_config.backend_base_url}
    manifest_path: Path | None = None

    try:
        stage_callable()
        manifest_payload["status"] = "completed"
    except Exception as exc:
        manifest_payload["status"] = "failed"
        manifest_payload["error"] = {
            "type": type(exc).__name__,
            "message": str(exc),
            "traceback": format_exc(),
        }
        raise
    finally:
        manifest_path = write_stage_manifest(stage_context, runtime_config, manifest_payload)

    if manifest_path is None:
        raise RuntimeError("Stage manifest path was not generated")

    return {"artifact_manifest_path": str(manifest_path)}


@dag(
    dag_id="domain_pack_generation",
    schedule=None,
    start_date=datetime(2024, 1, 1),
    catchup=False,
    default_args=DEFAULT_DAG_ARGS,
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
    def preprocessing() -> dict[str, str]:
        return _run_stage("preprocessing", preprocessing_run)

    @task(task_id="intent_discovery")
    def intent_discovery() -> dict[str, str]:
        return _run_stage("intent_discovery", intent_discovery_run)

    @task(task_id="draft_generation")
    def draft_generation() -> dict[str, str]:
        return _run_stage("draft_generation", draft_generation_run)

    @task(task_id="evaluation")
    def evaluation() -> dict[str, str]:
        return _run_stage("evaluation", evaluation_run)

    @task(task_id="publish_candidate")
    def publish_candidate() -> dict[str, str]:
        return _run_stage("publish_candidate", publish_candidate_run)

    ingestion_task = ingestion()
    preprocessing_task = preprocessing()
    intent_discovery_task = intent_discovery()
    draft_generation_task = draft_generation()
    evaluation_task = evaluation()
    publish_candidate_task = publish_candidate()

    ingestion_task >> preprocessing_task >> intent_discovery_task >> draft_generation_task >> evaluation_task >> publish_candidate_task


domain_pack_generation()
