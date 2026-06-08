from __future__ import annotations

from pathlib import Path
from typing import Any

from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from tests.helpers.artifacts import write_json_artifact, write_stage_manifest


def _runtime_config(tmp_path: Path) -> PipelineRuntimeConfig:
    return PipelineRuntimeConfig(artifact_root=tmp_path / "artifacts", backend_base_url="http://backend:8080")


def _stage_context(workspace_id: str | None = "ws1", dataset_id: str | None = None) -> StageContext:
    return StageContext(
        dag_id="dag",
        run_id="run1",
        stage_name="draft_generation",
        workspace_id=workspace_id,
        dataset_id=dataset_id,
    )


def _preprocessed_conv(conv_id: str, canonical: str = "text", problem: str = "problem") -> dict[str, Any]:
    return {
        "id": conv_id,
        "canonical_text": canonical,
        "customer_problem_text": problem,
        "ended_status": "resolved",
    }


def _write_clusters(clusters_dir: Path, clusters: list[dict[str, Any]]) -> None:
    write_json_artifact(
        clusters_dir / "clusters.json",
        {
            "schema_version": "1.0",
            "clusters": clusters,
            "stats": {"outlier_rate": 0.12},
            "flow_split_metrics": {
                "workflowSeparability": 0.9,
                "entrypointDistinctiveness": 0.72,
                "entrypointSemanticCoverage": 1.0,
            },
        },
    )


def _write_preprocessed(preprocessed_dir: Path, conversations: list[dict[str, Any]]) -> None:
    write_json_artifact(
        preprocessed_dir / "preprocessed_data.json",
        {"schema_version": "1.0", "conversations": conversations},
    )


def _write_upstream_manifest(tmp_path: Path) -> Path:
    return write_stage_manifest(
        tmp_path / "upstream_manifest.json",
        dag_id="dag",
        run_id="run1",
        stage_name="intent_discovery",
        workspace_id="ws1",
        dataset_id="ds1",
        pipeline_job_id="11",
    )
