from __future__ import annotations

from collections.abc import Mapping

from pipeline.common.context import StageContext


def context_value(context: Mapping[str, object], key: str) -> str | None:
    dag_run = context.get("dag_run")
    conf = getattr(dag_run, "conf", None)
    if isinstance(conf, Mapping) and conf.get(key) not in (None, ""):
        return str(conf[key])

    params = context.get("params")
    if isinstance(params, Mapping) and params.get(key) not in (None, ""):
        return str(params[key])

    return None


def stage_context_from_airflow_context(context: Mapping[str, object], stage_name: str) -> StageContext:
    dag = context["dag"]
    return StageContext(
        dag_id=str(getattr(dag, "dag_id")),
        run_id=str(context["run_id"]),
        stage_name=stage_name,
        workspace_id=context_value(context, "workspace_id"),
        dataset_id=context_value(context, "dataset_id"),
        pipeline_job_id=context_value(context, "pipeline_job_id"),
    )
