from __future__ import annotations

from datetime import datetime, timedelta

from airflow.sdk import dag, get_current_context, task

from pipeline.common.artifacts import write_stage_manifest
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext

DEFAULT_DAG_ARGS = {
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(minutes=30),
}


@dag(
    dag_id="dev_replay",
    schedule=None,
    start_date=datetime(2024, 1, 1),
    catchup=False,
    default_args=DEFAULT_DAG_ARGS,
    dagrun_timeout=timedelta(hours=2),
    max_active_runs=1,
    tags=["dev", "retry-test"],
)
def dev_replay() -> None:
    @task(task_id="prepare_replay")
    def prepare_replay() -> dict[str, str]:
        context = get_current_context()
        stage_context = StageContext(
            dag_id=context["dag"].dag_id,
            run_id=context["run_id"],
            stage_name="prepare_replay",
            workspace_id="local-workspace",
            dataset_id="retry-dataset",
            pipeline_job_id="retry-job",
        )
        runtime_config = PipelineRuntimeConfig.from_env()
        manifest_path = write_stage_manifest(
            stage_context,
            runtime_config,
            {"status": "prepared", "next_stage": "force_failure"},
        )
        return {"artifact_manifest_path": str(manifest_path)}

    @task(task_id="force_failure")
    def force_failure() -> None:
        context = get_current_context()
        raise RuntimeError(f"Intentional failure for retry and failed-state verification: run_id={context['run_id']}")

    prepare_replay() >> force_failure()


dev_replay()
