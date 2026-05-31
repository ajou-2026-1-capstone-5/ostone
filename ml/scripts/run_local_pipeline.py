from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections.abc import Mapping
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from pipeline.common.artifacts import write_stage_manifest
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineStageError
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
    raw_source = args.raw_log.resolve()
    try:
        raw_bytes, raw_input_summary = _load_raw_input(args, raw_source)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"Failed to load raw input: {exc}", file=sys.stderr)
        return 2

    artifact_root = args.artifact_root.resolve()
    run_id = args.run_id or f"manual__local_{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}"
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

    publish_result = _run_publish_candidate(str(evaluation_manifest_path))
    summary = _build_summary(
        artifact_root=artifact_root,
        run_id=run_id,
        raw_path=raw_source,
        raw_input_summary=raw_input_summary,
        manifests=manifests,
        candidate_path=candidate_path,
        publish_result=publish_result,
    )
    summary_path = artifact_root / "domain_pack_generation" / run_id / "local_run_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    _print_summary(summary, summary_path, workflow_limit=args.print_workflow_limit)
    return 0


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Run the ML domain-pack draft pipeline against parsed consultation JSON files, "
            "directories, or zip archives."
        ),
    )
    parser.add_argument(
        "raw_log",
        type=Path,
        help="Local parsed consultation JSON/JSONL file, zip archive, or directory of JSON files.",
    )
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
        "--input-glob",
        default="*.json",
        help="Glob used when raw_log is a directory. Defaults to recursive '*.json'.",
    )
    parser.add_argument(
        "--max-files",
        type=_positive_int,
        help="Limit the number of matched raw files loaded from a directory.",
    )
    parser.add_argument(
        "--source-filter",
        action="append",
        default=[],
        help=(
            "Local sampling helper. Includes rows whose source field, parent company directory, "
            "or filename prefix before '_' matches this value."
        ),
    )
    parser.add_argument(
        "--print-workflow-limit",
        type=_non_negative_int,
        default=20,
        help="Maximum number of workflow summaries printed to stdout. Use 0 to suppress workflow details.",
    )
    parser.add_argument(
        "--embedding-model-name",
        default=os.getenv("EMBEDDING_MODEL_NAME", "BAAI/bge-m3"),
        help="Embedding model name passed to the local FlagEmbedding runtime.",
    )
    parser.add_argument(
        "--embedding-batch-size",
        type=_positive_int,
        help="Batch size passed to the local FlagEmbedding runtime.",
    )
    parser.add_argument(
        "--embedding-max-length",
        type=_positive_int,
        help="Max token length passed to the local FlagEmbedding runtime.",
    )
    parser.add_argument(
        "--evaluation-benchmark-path",
        type=Path,
        help="Optional category-free benchmark suite JSON passed to the evaluation stage.",
    )
    return parser.parse_args()


def _positive_int(value: str) -> int:
    try:
        parsed = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("must be a positive integer") from exc
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be a positive integer")
    return parsed


def _non_negative_int(value: str) -> int:
    try:
        parsed = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("must be a non-negative integer") from exc
    if parsed < 0:
        raise argparse.ArgumentTypeError("must be a non-negative integer")
    return parsed


def _load_raw_input(args: argparse.Namespace, raw_source: Path) -> tuple[bytes, dict[str, object]]:
    if not raw_source.exists():
        raise ValueError(f"raw input does not exist: {raw_source}")
    if raw_source.is_file():
        raw_bytes = raw_source.read_bytes()
        file_rows = _load_json_rows(raw_source)
        return raw_bytes, {
            "rawInputKind": "file",
            "inputSchema": _detect_input_schema(file_rows),
            "rawInputPath": str(raw_source),
            "rawFileCount": 1,
            "rawConversationCount": len(file_rows),
            "sourceFilters": [],
        }
    if raw_source.is_dir():
        return _load_raw_directory(args, raw_source)
    raise ValueError(f"raw input must be a file or directory: {raw_source}")


def _load_raw_directory(args: argparse.Namespace, directory: Path) -> tuple[bytes, dict[str, object]]:
    matched_files = _matched_json_files(directory, args.input_glob)
    source_filters = set(args.source_filter)
    max_files = args.max_files

    selected_files: list[Path] = []
    rows: list[dict[str, object]] = []
    skipped_rows = 0
    unreadable_files: list[str] = []
    files_with_no_rows = 0
    for file_path in matched_files:
        try:
            file_rows = _load_json_rows(file_path)
        except (OSError, json.JSONDecodeError, ValueError):
            unreadable_files.append(str(file_path))
            continue

        included_rows = [row for row in file_rows if _matches_filters(row, source_filters, file_path)]
        skipped_rows += len(file_rows) - len(included_rows)
        if not included_rows:
            files_with_no_rows += 1
            continue

        selected_files.append(file_path)
        rows.extend(included_rows)
        if max_files is not None and len(selected_files) >= max_files:
            break

    if not rows:
        raise ValueError(
            "directory input did not contain any rows after filters: "
            f"path={directory}, matchedFiles={len(matched_files)}, unreadableFiles={len(unreadable_files)}"
        )

    payload = {"conversations": rows}
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), {
        "rawInputKind": "directory",
        "inputSchema": _detect_input_schema(rows),
        "rawInputPath": str(directory),
        "rawInputGlob": args.input_glob,
        "rawMatchedFileCount": len(matched_files),
        "rawFileCount": len(selected_files),
        "rawConversationCount": len(rows),
        "rawSkippedRowCount": skipped_rows,
        "rawFilesWithNoIncludedRows": files_with_no_rows,
        "rawUnreadableFileCount": len(unreadable_files),
        "rawUnreadableFileSample": unreadable_files[:5],
        "rawFileSample": [str(path.relative_to(directory)) for path in selected_files[:5]],
        "sourceFilters": sorted(source_filters),
    }


def _matched_json_files(directory: Path, input_glob: str) -> list[Path]:
    glob_pattern = input_glob.strip()
    if not glob_pattern:
        raise ValueError("--input-glob must not be blank")
    matched_files = sorted(
        (path for path in directory.rglob(glob_pattern) if path.is_file()),
        key=_natural_path_key,
    )
    if not matched_files:
        raise ValueError(f"no files matched directory input: path={directory}, glob={glob_pattern}")
    return matched_files


def _natural_path_key(path: Path) -> tuple[object, ...]:
    parts: list[object] = []
    for text in path.parts:
        for piece in re.split(r"(\d+)", text):
            if not piece:
                continue
            parts.append(int(piece) if piece.isdigit() else piece)
    return tuple(parts)


def _load_json_rows(file_path: Path) -> list[dict[str, object]]:
    try:
        rows = [dict(row) for row in ingestion._extract_raw_rows(file_path.read_bytes())]
    except PipelineStageError as exc:
        raise ValueError(f"invalid parsed consultation input in {file_path}: {exc}") from exc
    if not rows:
        raise ValueError(f"raw file did not contain JSON object rows: {file_path}")
    return rows


def _matches_filters(
    row: Mapping[str, object],
    source_filters: set[str],
    file_path: Path,
) -> bool:
    if source_filters and _row_source_or_file_prefix(row, file_path) not in source_filters:
        return False
    return True


def _row_source_or_file_prefix(row: Mapping[str, object], file_path: Path) -> str:
    source = _row_text(row, "source")
    if source:
        return source
    parent = file_path.parent.name
    if parent and parent not in {"source", "training", "validation", "dataset"}:
        return parent
    stem = file_path.stem
    if "_" not in stem:
        return stem
    return stem.split("_", 1)[0]


def _row_text(row: Mapping[str, object], key: str) -> str:
    value = row.get(key)
    return "" if value is None else str(value).strip()


def _detect_input_schema(rows: list[dict[str, object]]) -> str:
    if rows and all(_is_parsed_consultation_row(row) for row in rows):
        return "parsed-consultation-dataset.v1"
    return "legacy-or-mixed-consultation-dataset"


def _is_parsed_consultation_row(row: Mapping[str, object]) -> bool:
    turns = row.get("turns")
    if not isinstance(turns, list) or not turns:
        return False
    if _row_text(row, "source_id") == "":
        return False
    return all(_is_parsed_turn(turn) for turn in turns)


def _is_parsed_turn(value: object) -> bool:
    if not isinstance(value, Mapping):
        return False
    return (
        isinstance(value.get("turn_index"), int)
        and str(value.get("speaker_role") or "") in {"CUSTOMER", "AGENT"}
        and bool(str(value.get("message_text") or "").strip())
    )


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
            "PIPELINE_ANALYSIS_UNIT": "caselet",
            "PIPELINE_INTENT_DISCOVERY_MODE": "graph_leiden",
            "ML_EMBEDDING_RUNTIME": "flag_embedding",
            "EMBEDDING_MODEL_NAME": args.embedding_model_name,
        }
    )
    if args.embedding_batch_size is not None:
        os.environ["EMBEDDING_RUNTIME_BATCH_SIZE"] = str(args.embedding_batch_size)
    if args.embedding_max_length is not None:
        os.environ["EMBEDDING_MAX_LENGTH"] = str(args.embedding_max_length)
    if args.evaluation_benchmark_path is not None:
        os.environ["PIPELINE_EVALUATION_BENCHMARK_PATH"] = str(args.evaluation_benchmark_path.resolve())


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


def _run_publish_candidate(evaluation_manifest_path: str) -> dict[str, object]:
    try:
        return publish_candidate.run(evaluation_manifest_path)
    except publish_candidate.PublishCandidateStageError as exc:
        return exc.manifest_payload
    except Exception as exc:
        return {
            "publish_status": "FAILED_LOCAL",
            "publish_result_path": None,
            "error": {"type": type(exc).__name__, "message": str(exc)},
        }


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
    raw_input_summary: dict[str, object],
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
        "rawInput": raw_input_summary,
        "candidatePath": str(candidate_path),
        "publishResultPath": publish_result.get("publish_result_path"),
        "publishStatus": publish_result.get("publish_status"),
        "publishError": publish_result.get("error"),
        "manifests": manifests,
        "evaluationSummary": candidate.get("evaluationSummary"),
        "intentCount": len(_intent_items(candidate)),
        "workflowCount": len(workflows),
        "slotCount": len(_workflow_list(candidate, "slots")),
        "intentSlotBindingCount": len(_workflow_list(candidate, "intentSlotBindings")),
        "policyCount": len(_workflow_list(candidate, "policies")),
        "riskCount": len(_workflow_list(candidate, "risks")),
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
    meta = _parse_graph(workflow.get("metaJson"))
    return {
        "workflowCode": workflow.get("workflowCode"),
        "name": workflow.get("name"),
        "intentCode": workflow.get("intentCode"),
        "confidence": meta.get("workflowConfidence"),
        "reviewTier": meta.get("reviewTier"),
        "needsHumanReview": meta.get("needsHumanReview"),
        "reviewReasonCodes": meta.get("reviewReasonCodes", []),
        "sampleReviewReasonCodes": meta.get("sampleReviewReasonCodes", []),
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


def _print_summary(summary: dict[str, object], summary_path: Path, workflow_limit: int) -> None:
    print(f"summaryPath: {summary_path}")
    print(f"candidatePath: {summary['candidatePath']}")
    print(f"publishStatus: {summary['publishStatus']}")
    print(f"evaluationSummary: {json.dumps(summary['evaluationSummary'], ensure_ascii=False, sort_keys=True)}")
    print(
        f"intents={summary['intentCount']} workflows={summary['workflowCount']} "
        f"slots={summary['slotCount']} policies={summary['policyCount']} risks={summary['riskCount']}"
    )
    workflows = summary.get("workflowSummaries")
    if not isinstance(workflows, list):
        return
    printed = 0
    for workflow in workflows[:workflow_limit]:
        if not isinstance(workflow, dict):
            continue
        printed += 1
        review_suffix = ""
        if workflow.get("reviewTier") or workflow.get("confidence") is not None:
            review_suffix = (
                f" confidence={workflow.get('confidence')} reviewTier={workflow.get('reviewTier')} "
                f"needsHumanReview={workflow.get('needsHumanReview')}"
            )
        print(f"- {workflow.get('workflowCode')} {workflow.get('name')}{review_suffix}")
        print(f"  nodes: {workflow.get('nodes')}")
        print(f"  edges: {workflow.get('edges')}")
    remaining = len(workflows) - printed
    if remaining > 0:
        print(f"... {remaining} more workflows in summary file")


if __name__ == "__main__":
    raise SystemExit(main())
