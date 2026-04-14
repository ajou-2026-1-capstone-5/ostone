from __future__ import annotations

import logging

from pipeline.common.context import StageContext


def get_stage_logger(stage_context: StageContext) -> logging.LoggerAdapter[logging.Logger]:
    logger = logging.getLogger(f"pipeline.{stage_context.stage_name}")
    return logging.LoggerAdapter(
        logger,
        {
            "workspace_id": stage_context.workspace_id or "unknown",
            "dataset_id": stage_context.dataset_id or "unknown",
            "pipeline_job_id": stage_context.pipeline_job_id or "unknown",
            "stage_name": stage_context.stage_name,
        },
    )
