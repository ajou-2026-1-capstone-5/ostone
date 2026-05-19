from __future__ import annotations

import json
import os
import re
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast

import boto3  # type: ignore[import-untyped]
from botocore.config import Config  # type: ignore[import-untyped]

from pipeline.common.artifacts import ensure_stage_directory, write_stage_manifest
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineConfigurationError, PipelineStageError

DEFAULT_INGESTION_ARTIFACT_NAME = "conversations.jsonl"
CUSTOMER_ROLE = "CUSTOMER"
AGENT_ROLE = "AGENT"

_CUSTOMER_PREFIXES = ("고객님", "Customer", "CLIENT", "문의자", "고객", "손님", "C")
_AGENT_PREFIXES = ("상담직원", "상담사", "상담원", "Agent", "직원", "A")
_ROLE_PREFIX_SEPARATORS = (":", "：", "-", ")")
_SPEAKER_SEPARATORS = (":", "：")


@dataclass(frozen=True)
class IngestionRuntimeContext:
    stage_context: StageContext
    object_key: str


def run(upstream_manifest_path: str | None = None) -> dict[str, str]:
    _ = upstream_manifest_path
    runtime_config = PipelineRuntimeConfig.from_env()
    runtime_context = _resolve_runtime_context()
    output_dir = ensure_stage_directory(runtime_context.stage_context, runtime_config)
    output_path = output_dir / DEFAULT_INGESTION_ARTIFACT_NAME

    raw_bytes = _read_raw_object(runtime_context.object_key)
    conversations = list(_parse_raw_payload(raw_bytes, runtime_context.stage_context.dataset_id))
    if not conversations:
        raise PipelineStageError("Raw consultation file did not contain any parseable conversations.")

    _write_jsonl(output_path, conversations)
    manifest_path = write_stage_manifest(
        runtime_context.stage_context,
        runtime_config,
        {
            "artifact_path": output_path.name,
            "object_key": runtime_context.object_key,
            "conversation_count": len(conversations),
        },
    )
    return {"artifact_manifest_path": str(manifest_path.resolve())}


def _resolve_runtime_context() -> IngestionRuntimeContext:
    airflow_context = _load_airflow_context()
    dag_id = _context_value(airflow_context, "dag_id", "AIRFLOW_DAG_ID", "domain_pack_generation")
    run_id = _context_value(airflow_context, "run_id", "AIRFLOW_RUN_ID", "manual")
    workspace_id = _context_value(airflow_context, "workspace_id", "PIPELINE_WORKSPACE_ID", None)
    dataset_id = _context_value(airflow_context, "dataset_id", "PIPELINE_DATASET_ID", None)
    pipeline_job_id = _context_value(airflow_context, "pipeline_job_id", "PIPELINE_JOB_ID", None)
    object_key = _context_value(airflow_context, "object_key", "PIPELINE_RAW_OBJECT_KEY", None)

    if object_key is None or not str(object_key).strip():
        raise PipelineConfigurationError("object_key must be provided by Airflow conf or PIPELINE_RAW_OBJECT_KEY.")

    return IngestionRuntimeContext(
        stage_context=StageContext(
            dag_id=str(dag_id),
            run_id=str(run_id),
            stage_name="ingestion",
            workspace_id=_optional_str(workspace_id),
            dataset_id=_optional_str(dataset_id),
            pipeline_job_id=_optional_str(pipeline_job_id),
        ),
        object_key=str(object_key).strip(),
    )


def _load_airflow_context() -> Mapping[str, Any]:
    try:
        from airflow.sdk import get_current_context  # type: ignore[import-untyped]

        context = get_current_context()
    except Exception:
        return {}
    if not isinstance(context, Mapping):
        return {}
    return context


def _context_value(
    context: Mapping[str, Any],
    key: str,
    env_key: str,
    default: str | None,
) -> object | None:
    dag_run = context.get("dag_run")
    conf = getattr(dag_run, "conf", None)
    if isinstance(conf, Mapping) and conf.get(key) not in (None, ""):
        return conf.get(key)

    params = context.get("params")
    if isinstance(params, Mapping) and params.get(key) not in (None, ""):
        return params.get(key)

    if key == "dag_id":
        dag = context.get("dag")
        dag_id = getattr(dag, "dag_id", None)
        if dag_id:
            return dag_id
    if key == "run_id":
        run_id = context.get("run_id")
        if run_id:
            return run_id

    value = os.getenv(env_key)
    if value not in (None, ""):
        return value
    return default


def _read_raw_object(object_key: str) -> bytes:
    bucket = _required_env("STORAGE_S3_BUCKET")
    client = _s3_client()
    try:
        response = client.get_object(Bucket=bucket, Key=object_key)
        body = response["Body"]
        return cast(bytes, body.read())
    except Exception as exc:
        raise PipelineStageError(f"Failed to read raw object from S3/MinIO: key={object_key}") from exc


def _s3_client() -> Any:
    endpoint_url = _optional_env("STORAGE_S3_ENDPOINT")
    access_key = _optional_env("STORAGE_S3_ACCESS_KEY")
    secret_key = _optional_env("STORAGE_S3_SECRET_KEY")
    region_name = os.getenv("STORAGE_S3_REGION", "ap-northeast-2").strip() or "ap-northeast-2"
    path_style = _parse_bool(os.getenv("STORAGE_S3_PATH_STYLE", "false"))
    addressing_style = "path" if path_style else "auto"

    kwargs: dict[str, Any] = {
        "service_name": "s3",
        "region_name": region_name,
        "config": Config(s3={"addressing_style": addressing_style}),
    }
    if endpoint_url:
        kwargs["endpoint_url"] = endpoint_url
    if access_key and secret_key:
        kwargs["aws_access_key_id"] = access_key
        kwargs["aws_secret_access_key"] = secret_key
    return boto3.client(**kwargs)


def _parse_raw_payload(raw_bytes: bytes, dataset_id: str | None) -> Iterable[dict[str, object]]:
    text = raw_bytes.decode("utf-8-sig")
    payload = _load_json_or_jsonl(text)
    rows = _extract_rows(payload)
    for index, row in enumerate(rows):
        conversation = _build_conversation(row, index, dataset_id)
        if conversation is not None:
            yield conversation


def _load_json_or_jsonl(text: str) -> object:
    stripped = text.strip()
    if not stripped:
        return []
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        rows: list[object] = []
        for line_number, line in enumerate(stripped.splitlines(), start=1):
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise PipelineStageError(f"Invalid JSONL line in raw consultation file: {line_number}") from exc
        return rows


def _extract_rows(payload: object) -> list[Mapping[str, object]]:
    if isinstance(payload, list):
        return [cast(Mapping[str, object], row) for row in payload if isinstance(row, Mapping)]
    if isinstance(payload, Mapping):
        conversations = payload.get("conversations") or payload.get("data") or payload.get("items")
        if isinstance(conversations, list):
            return [cast(Mapping[str, object], row) for row in conversations if isinstance(row, Mapping)]
        return [cast(Mapping[str, object], payload)]
    raise PipelineStageError("Raw consultation file must be a JSON object, JSON array, or JSONL.")


def _build_conversation(
    row: Mapping[str, object],
    index: int,
    dataset_id: str | None,
) -> dict[str, object] | None:
    turns = _extract_turns(row)
    if not turns:
        return None
    source_id = _first_text(row, ("source_id", "id", "consultation_id", "case_id")) or f"conversation_{index:06d}"
    return {
        "id": source_id,
        "dataset_id": dataset_id or str(_first_text(row, ("dataset_id",)) or ""),
        "channel": _first_text(row, ("channel", "source")),
        "ended_status": _first_text(row, ("ended_status", "status")),
        "turns": turns,
    }


def _extract_turns(row: Mapping[str, object]) -> list[dict[str, object]]:
    turns_payload = row.get("turns")
    if isinstance(turns_payload, list):
        return _turns_from_payload(turns_payload)

    content = _first_text(row, ("consulting_content", "content", "text", "full_text", "conversation"))
    if not content:
        return []
    return _parse_consulting_content(content)


def _turns_from_payload(turns_payload: list[object]) -> list[dict[str, object]]:
    turns: list[dict[str, object]] = []
    for index, item in enumerate(turns_payload):
        if isinstance(item, Mapping):
            speaker = _first_text(item, ("speaker_role", "speaker", "role", "화자")) or CUSTOMER_ROLE
            text = _first_text(item, ("message_text", "text", "utterance", "content", "발화"))
        else:
            speaker = CUSTOMER_ROLE
            text = str(item)
        cleaned = _normalize_text(text)
        if cleaned:
            turns.append(
                {
                    "turn_index": index,
                    "speaker_role": _normalize_speaker_role(speaker),
                    "message_text": cleaned,
                }
            )
    return turns


def _parse_consulting_content(content: str) -> list[dict[str, object]]:
    lines = [line.strip() for line in _normalize_text(content).split("\n") if line.strip()]
    if not lines:
        return []

    turns: list[dict[str, object]] = []
    current_role: str | None = None
    current_parts: list[str] = []

    def flush() -> None:
        nonlocal current_role, current_parts
        text = _normalize_text(" ".join(current_parts))
        if text:
            turns.append(
                {
                    "turn_index": len(turns),
                    "speaker_role": current_role or CUSTOMER_ROLE,
                    "message_text": text,
                }
            )
        current_role = None
        current_parts = []

    for line in lines:
        customer_text = _split_role_prefix(line, _CUSTOMER_PREFIXES)
        agent_text = _split_role_prefix(line, _AGENT_PREFIXES)
        speaker_parts = _split_named_speaker(line)
        if customer_text is not None:
            flush()
            current_role = CUSTOMER_ROLE
            current_parts = [customer_text]
        elif agent_text is not None:
            flush()
            current_role = AGENT_ROLE
            current_parts = [agent_text]
        elif speaker_parts is not None and _looks_like_speaker(speaker_parts[0]):
            flush()
            current_role = _normalize_speaker_role(speaker_parts[0])
            current_parts = [speaker_parts[1]]
        else:
            current_parts.append(line)

    flush()
    if turns:
        return turns
    return [{"turn_index": 0, "speaker_role": CUSTOMER_ROLE, "message_text": _normalize_text(content)}]


def _split_role_prefix(line: str, prefixes: tuple[str, ...]) -> str | None:
    stripped = line.strip()
    lower = stripped.lower()
    for prefix in prefixes:
        if not lower.startswith(prefix.lower()):
            continue
        remainder = stripped[len(prefix) :].lstrip()
        if remainder and remainder[0] in _ROLE_PREFIX_SEPARATORS:
            return remainder[1:].strip()
    return None


def _split_named_speaker(line: str) -> tuple[str, str] | None:
    stripped = line.strip()
    for separator in _SPEAKER_SEPARATORS:
        if separator not in stripped:
            continue
        speaker, message = stripped.split(separator, 1)
        speaker = speaker.strip()
        if _is_speaker_token(speaker):
            return speaker, message.strip()
    return None


def _is_speaker_token(value: str) -> bool:
    if not 1 <= len(value) <= 20:
        return False
    return all(char.isalnum() or char.isspace() or char == "_" for char in value)


def _first_text(row: Mapping[str, object], keys: tuple[str, ...]) -> str | None:
    for key in keys:
        value = row.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
        if value is not None and not isinstance(value, (dict, list)):
            text = str(value).strip()
            if text:
                return text
    return None


def _looks_like_speaker(value: str) -> bool:
    return _normalize_speaker_role(value) in {CUSTOMER_ROLE, AGENT_ROLE}


def _normalize_speaker_role(value: str) -> str:
    normalized = value.strip()
    lower = normalized.lower()
    if lower in {"customer", "client", "c"} or any(token in normalized for token in ("고객", "손님", "문의자")):
        return CUSTOMER_ROLE
    if lower in {"agent", "a"} or any(token in normalized for token in ("상담", "직원")):
        return AGENT_ROLE
    return CUSTOMER_ROLE


def _normalize_text(value: object) -> str:
    text = "" if value is None else str(value)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[\t ]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _write_jsonl(path: Path, rows: Iterable[dict[str, object]]) -> None:
    with path.open("w", encoding="utf-8") as output:
        for row in rows:
            output.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")


def _required_env(key: str) -> str:
    value = os.getenv(key, "").strip()
    if not value:
        raise PipelineConfigurationError(f"{key} must not be blank.")
    return value


def _optional_env(key: str) -> str | None:
    value = os.getenv(key, "").strip()
    return value or None


def _optional_str(value: object | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _parse_bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}
