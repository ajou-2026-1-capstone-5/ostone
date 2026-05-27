from __future__ import annotations

import argparse
import json
import os
import sys
from collections.abc import Mapping
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from pipeline.common.artifacts import write_stage_manifest
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.stages.draft_generation import main as draft_generation
from pipeline.stages.evaluation import main as evaluation
from pipeline.stages.flow_splitting import main as flow_splitting
from pipeline.stages.ingestion import main as ingestion
from pipeline.stages.intent_discovery import main as intent_discovery
from pipeline.stages.preprocessing import main as preprocessing
from pipeline.stages.publish_candidate import main as publish_candidate
from pipeline.stages.representation import main as representation


def main() -> int:
    args = _parse_args()
    raw_path = args.raw_log.resolve()
    if not raw_path.exists() or not raw_path.is_file():
        print(f"Raw log file does not exist: {raw_path}", file=sys.stderr)
        return 2

    artifact_root = args.artifact_root.resolve()
    run_id = args.run_id or f"manual__local_{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}"
    raw_bytes = raw_path.read_bytes()
    ingestion._read_raw_object = lambda _object_key: raw_bytes  # type: ignore[assignment]
    _configure_env(args, artifact_root, run_id)

    manifests: list[dict[str, str]] = []
    ingestion_result = ingestion.run()
    manifest_path = _manifest_path(ingestion_result, "ingestion")
    manifests.append({"stage": "ingestion", "path": manifest_path})

    for stage_name, stage_run in (
        ("preprocessing", preprocessing.run),
        ("representation", representation.run),
        ("intent_discovery", intent_discovery.run),
        ("flow_splitting", flow_splitting.run),
        ("draft_generation", draft_generation.run),
    ):
        stage_result = stage_run(manifest_path)
        manifest_path = _manifest_path(stage_result, stage_name)
        manifests.append({"stage": stage_name, "path": manifest_path})

    draft_manifest_path = manifest_path
    evaluation_result = evaluation.run(draft_manifest_path)
    candidate_path = _candidate_path(evaluation_result)
    evaluation_manifest_path = _write_evaluation_manifest(
        artifact_root=artifact_root,
        run_id=run_id,
        workspace_id=args.workspace_id,
        dataset_id=args.dataset_id,
        pipeline_job_id=args.pipeline_job_id,
        draft_manifest_path=draft_manifest_path,
        candidate_path=candidate_path,
        evaluation_summary=evaluation_result.get("evaluation_summary"),
    )
    manifests.append({"stage": "evaluation", "path": str(evaluation_manifest_path)})

    publish_result = publish_candidate.run(str(evaluation_manifest_path))
    summary = _build_summary(
        artifact_root=artifact_root,
        run_id=run_id,
        raw_path=raw_path,
        manifests=manifests,
        candidate_path=candidate_path,
        publish_result=publish_result,
    )
    summary_path = artifact_root / "domain_pack_generation" / run_id / "local_run_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    _print_summary(summary, summary_path)
    return 0


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the ML domain-pack draft pipeline against a local consultation log file.",
    )
    parser.add_argument("raw_log", type=Path, help="Local JSON or JSONL consultation log file.")
    parser.add_argument(
        "--artifact-root",
        type=Path,
        default=Path(".local-artifacts"),
        help="Directory where pipeline artifacts will be written.",
    )
    parser.add_argument("--run-id", help="Stable run id. Defaults to a timestamped manual run id.")
    parser.add_argument("--workspace-id", default="local-workspace")
    parser.add_argument("--dataset-id", default="local-dataset")
    parser.add_argument("--pipeline-job-id", default="1001")
    parser.add_argument("--backend-base-url", default="http://backend.local")
    parser.add_argument(
        "--intent-discovery-mode",
        choices=("graph_leiden", "boundary_segment", "legacy_embedding"),
        default="graph_leiden",
    )
    return parser.parse_args()


def _configure_env(args: argparse.Namespace, artifact_root: Path, run_id: str) -> None:
    os.environ.update(
        {
            "PIPELINE_ARTIFACT_ROOT": str(artifact_root),
            "PIPELINE_BACKEND_BASE_URL": args.backend_base_url,
            "PIPELINE_CALLBACK_ENABLED": "false",
            "AIRFLOW_DAG_ID": "domain_pack_generation",
            "AIRFLOW_RUN_ID": run_id,
            "PIPELINE_WORKSPACE_ID": args.workspace_id,
            "PIPELINE_DATASET_ID": args.dataset_id,
            "PIPELINE_JOB_ID": args.pipeline_job_id,
            "PIPELINE_RAW_OBJECT_KEY": str(args.raw_log),
            "PIPELINE_INTENT_DISCOVERY_MODE": args.intent_discovery_mode,
        }
    )


def _manifest_path(stage_result: Mapping[str, object], stage_name: str) -> str:
    value = stage_result.get("artifact_manifest_path")
    if isinstance(value, str) and value:
        return value
    raise RuntimeError(f"{stage_name} did not return artifact_manifest_path: {stage_result}")


def _candidate_path(stage_result: Mapping[str, object]) -> Path:
    value = stage_result.get("candidateArtifactPath")
    if isinstance(value, str) and value:
        return Path(value)
    raise RuntimeError(f"evaluation did not return candidateArtifactPath: {stage_result}")


def _write_evaluation_manifest(
    *,
    artifact_root: Path,
    run_id: str,
    workspace_id: str,
    dataset_id: str,
    pipeline_job_id: str,
    draft_manifest_path: str,
    candidate_path: Path,
    evaluation_summary: object,
) -> Path:
    runtime_config = PipelineRuntimeConfig.from_env()
    context = StageContext(
        dag_id="domain_pack_generation",
        run_id=run_id,
        stage_name="evaluation",
        workspace_id=workspace_id,
        dataset_id=dataset_id,
        pipeline_job_id=pipeline_job_id,
    )
    candidate_uri = (
        candidate_path.name if candidate_path.parent == context.artifact_dir(runtime_config) else str(candidate_path)
    )
    return write_stage_manifest(
        context,
        runtime_config,
        {
            "upstream_manifest_path": draft_manifest_path,
            "candidateArtifactPath": candidate_uri,
            "evaluation_summary": evaluation_summary,
            "artifact_root": str(artifact_root),
        },
    )


def _build_summary(
    *,
    artifact_root: Path,
    run_id: str,
    raw_path: Path,
    manifests: list[dict[str, str]],
    candidate_path: Path,
    publish_result: dict[str, object],
) -> dict[str, object]:
    candidate = _read_json(candidate_path)
    workflows = _workflow_items(candidate)
    return {
        "artifactRoot": str(artifact_root),
        "runId": run_id,
        "rawLogPath": str(raw_path),
        "candidatePath": str(candidate_path),
        "publishResultPath": publish_result.get("publish_result_path"),
        "publishStatus": publish_result.get("publish_status"),
        "manifests": manifests,
        "evaluationSummary": candidate.get("evaluationSummary"),
        "intentCount": len(_intent_items(candidate)),
        "workflowCount": len(workflows),
        "slotCount": len(_workflow_list(candidate, "slots")),
        "workflowSummaries": [_workflow_summary(workflow) for workflow in workflows],
    }


def _intent_items(candidate: dict[str, Any]) -> list[dict[str, Any]]:
    intent_draft = candidate.get("intentDraft")
    if not isinstance(intent_draft, dict):
        return []
    return _dict_items(intent_draft.get("intents"))


def _workflow_items(candidate: dict[str, Any]) -> list[dict[str, Any]]:
    return _workflow_list(candidate, "workflows")


def _workflow_list(candidate: dict[str, Any], key: str) -> list[dict[str, Any]]:
    workflow_draft = candidate.get("workflowDraft")
    if not isinstance(workflow_draft, dict):
        return []
    return _dict_items(workflow_draft.get(key))


def _dict_items(value: object) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _workflow_summary(workflow: dict[str, Any]) -> dict[str, object]:
    graph = _parse_graph(workflow.get("graphJson"))
    return {
        "workflowCode": workflow.get("workflowCode"),
        "name": workflow.get("name"),
        "intentCode": workflow.get("intentCode"),
        "nodes": [
            {"id": node.get("id"), "type": node.get("type"), "label": node.get("label")}
            for node in graph.get("nodes", [])
            if isinstance(node, dict)
        ],
        "edges": [
            {"from": edge.get("from"), "to": edge.get("to"), "label": edge.get("label")}
            for edge in graph.get("edges", [])
            if isinstance(edge, dict)
        ],
    }


def _parse_graph(value: object) -> dict[str, Any]:
    if not isinstance(value, str):
        return {}
    try:
        graph = json.loads(value)
    except json.JSONDecodeError:
        return {}
    return graph if isinstance(graph, dict) else {}


def _read_json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise RuntimeError(f"Expected JSON object: {path}")
    return payload


def _print_summary(summary: dict[str, object], summary_path: Path) -> None:
    print(f"summaryPath: {summary_path}")
    print(f"candidatePath: {summary['candidatePath']}")
    print(f"publishStatus: {summary['publishStatus']}")
    print(f"evaluationSummary: {json.dumps(summary['evaluationSummary'], ensure_ascii=False, sort_keys=True)}")
    print(f"intents={summary['intentCount']} workflows={summary['workflowCount']} slots={summary['slotCount']}")
    workflows = summary.get("workflowSummaries")
    if not isinstance(workflows, list):
        return
    for workflow in workflows:
        if not isinstance(workflow, dict):
            continue
        print(f"- {workflow.get('workflowCode')} {workflow.get('name')}")
        print(f"  nodes: {workflow.get('nodes')}")
        print(f"  edges: {workflow.get('edges')}")


if __name__ == "__main__":
    raise SystemExit(main())
