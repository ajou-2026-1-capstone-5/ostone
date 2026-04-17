"""Development-only smoke-test DAG.

This DAG is an explicit exception to the six-stage production pipeline rule and
exists only to validate local Airflow parsing, artifact directory creation, and
manifest writes.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from airflow.sdk import dag, get_current_context, task

from pipeline.common.artifacts import write_stage_manifest
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.dag_defaults import DEFAULT_DAG_ARGS


@dag(
    dag_id="dev_bootstrap",
    schedule=None,
    start_date=datetime(2024, 1, 1),
    catchup=False,
    default_args=default_dag_args(),
    dagrun_timeout=timedelta(hours=2),
    max_active_runs=1,
    tags=["dev", "smoke-test"],
)
def dev_bootstrap() -> None:
    @task(task_id="bootstrap_smoke")
    def bootstrap_smoke() -> dict[str, str]:
        context = get_current_context()
        stage_context = StageContext(
            dag_id=context["dag"].dag_id,
            run_id=context["run_id"],
            stage_name="bootstrap_smoke",
            workspace_id="local-workspace",
            dataset_id="smoke-dataset",
            pipeline_job_id="smoke-job",
        )
        runtime_config = PipelineRuntimeConfig.from_env()
        manifest_path = write_stage_manifest(
            stage_context,
            runtime_config,
            {
                "status": "ok",
                "checks": ["dag_import", "artifact_directory", "manifest_write"],
                "backend_base_url": runtime_config.backend_base_url,
            },
        )
        return {"artifact_manifest_path": str(manifest_path)}

    bootstrap_smoke()


dev_bootstrap()
