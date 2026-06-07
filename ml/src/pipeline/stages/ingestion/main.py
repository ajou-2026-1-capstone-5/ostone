from __future__ import annotations

import json
import os
import re
import tempfile
import zipfile
from collections.abc import Iterable, Iterator, Mapping
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path, PurePosixPath
from typing import IO, Any, cast

import boto3  # type: ignore[import-untyped]
from botocore.config import Config  # type: ignore[import-untyped]

from pipeline.common.artifacts import ensure_stage_directory, write_stage_manifest
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineConfigurationError, PipelineStageError

DEFAULT_INGESTION_ARTIFACT_NAME = "conversations.jsonl"
CUSTOMER_ROLE = "CUSTOMER"
AGENT_ROLE = "AGENT"
PARSED_DATASET_SCHEMA_VERSION = "parsed-consultation-dataset.v1"

# Streaming ingestion limits sized for the 2vCPU/8GB Fargate task. Peak memory stays
# O(chunk + single-entry) because the raw object is staged to disk and parsed entry by
# entry, so these caps guard ephemeral disk, decompression cost, and downstream volume
# rather than process memory.
_DOWNLOAD_CHUNK_BYTES = 8 * 1024 * 1024
# Upload/storage permits up to 4GB raw objects; reject anything larger before it lands on disk.
MAX_RAW_OBJECT_BYTES = 4 * 1024 * 1024 * 1024
MAX_ZIP_ENTRY_COUNT = 100_000
MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES = 64 * 1024 * 1024
MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES = 12 * 1024 * 1024 * 1024
MAX_ZIP_COMPRESSION_RATIO = 100
MAX_INGESTION_CONVERSATIONS = 50_000

_FORBIDDEN_INPUT_KEYS = frozenset({"consulting_category"})
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

    raw_path = _read_raw_object(runtime_context.object_key)
    try:
        conversations = _parse_raw_payload(raw_path, runtime_context.stage_context.dataset_id)
        conversation_count = _write_jsonl(output_path, conversations)
    finally:
        raw_path.unlink(missing_ok=True)

    if conversation_count == 0:
        raise PipelineStageError("Raw consultation file did not contain any parseable conversations.")

    manifest_path = write_stage_manifest(
        runtime_context.stage_context,
        runtime_config,
        {
            "artifact_path": output_path.name,
            "object_key": runtime_context.object_key,
            "conversation_count": conversation_count,
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
        object_key = _context_value(airflow_context, "objectKey", "PIPELINE_RAW_OBJECT_KEY", None)

    if object_key is None or not str(object_key).strip():
        raise PipelineConfigurationError(
            "object_key/objectKey must be provided by Airflow conf or PIPELINE_RAW_OBJECT_KEY."
        )

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


def _read_raw_object(object_key: str) -> Path:
    bucket = _required_env("STORAGE_S3_BUCKET")
    client = _s3_client()
    handle, temp_name = tempfile.mkstemp(prefix="ingestion-raw-", suffix=".bin", dir=_scratch_dir())
    temp_path = Path(temp_name)
    try:
        response = client.get_object(Bucket=bucket, Key=object_key)
        with os.fdopen(handle, "wb") as scratch:
            _stream_body_to_file(response["Body"], scratch, object_key)
        return temp_path
    except PipelineStageError:
        temp_path.unlink(missing_ok=True)
        raise
    except Exception as exc:
        temp_path.unlink(missing_ok=True)
        raise PipelineStageError(f"Failed to read raw object from S3/MinIO: key={object_key}") from exc


def _stream_body_to_file(body: Any, destination: IO[bytes], object_key: str) -> None:
    downloaded = 0
    while True:
        chunk = body.read(_DOWNLOAD_CHUNK_BYTES)
        if not chunk:
            break
        downloaded += len(chunk)
        if downloaded > MAX_RAW_OBJECT_BYTES:
            raise PipelineStageError(
                "업로드 파일 크기가 처리 가능 한도를 초과했습니다. "
                f"key={object_key}, 최대 {MAX_RAW_OBJECT_BYTES} 바이트까지 처리할 수 있습니다."
            )
        destination.write(chunk)


def _scratch_dir() -> str:
    return os.getenv("PIPELINE_SCRATCH_DIR", "").strip() or tempfile.gettempdir()


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


def _parse_raw_payload(source: Path | bytes, dataset_id: str | None) -> Iterator[dict[str, object]]:
    emitted = 0
    for index, row in enumerate(_extract_raw_rows(source)):
        conversation = _build_conversation(row, index, dataset_id)
        if conversation is None:
            continue
        emitted += 1
        if emitted > MAX_INGESTION_CONVERSATIONS:
            raise PipelineStageError(
                f"처리 가능 상담 건수를 초과했습니다. 최대 {MAX_INGESTION_CONVERSATIONS}건까지 처리할 수 있습니다."
            )
        yield conversation


def _extract_raw_rows(source: Path | bytes) -> Iterator[Mapping[str, object]]:
    if isinstance(source, Path):
        if zipfile.is_zipfile(source):
            yield from _extract_rows_from_zip(source)
            return
        text = source.read_bytes().decode("utf-8-sig")
    else:
        if zipfile.is_zipfile(BytesIO(source)):
            yield from _extract_rows_from_zip(BytesIO(source))
            return
        text = source.decode("utf-8-sig")
    yield from _extract_rows(_load_json_or_jsonl(text))


def _extract_rows_from_zip(source: Path | BytesIO) -> Iterator[Mapping[str, object]]:
    emitted = False
    try:
        with zipfile.ZipFile(source) as archive:
            entries = sorted(archive.infolist(), key=lambda item: item.filename)
            _enforce_zip_limits(entries)
            for info in entries:
                if info.is_dir() or not _is_supported_archive_member(info):
                    continue
                with archive.open(info) as member:
                    payload = _load_json_or_jsonl(member.read().decode("utf-8-sig"))
                for row in _extract_rows(payload):
                    emitted = True
                    yield row
    except (OSError, zipfile.BadZipFile, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise PipelineStageError("Invalid parsed consultation zip archive.") from exc
    if not emitted:
        raise PipelineStageError("Parsed consultation zip archive did not contain any JSON conversation rows.")


def _enforce_zip_limits(entries: list[zipfile.ZipInfo]) -> None:
    if len(entries) > MAX_ZIP_ENTRY_COUNT:
        raise PipelineStageError(
            f"압축 파일의 항목 수가 처리 가능 한도를 초과했습니다. 최대 {MAX_ZIP_ENTRY_COUNT}개까지 처리할 수 있습니다."
        )
    total_uncompressed = 0
    total_compressed = 0
    for info in entries:
        if info.is_dir():
            continue
        if info.file_size > MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES:
            raise PipelineStageError(
                "압축 파일 내 단일 항목 크기가 처리 가능 한도를 초과했습니다. "
                f"최대 {MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES} 바이트까지 처리할 수 있습니다: {info.filename}"
            )
        if info.compress_size > 0 and info.file_size / info.compress_size > MAX_ZIP_COMPRESSION_RATIO:
            raise PipelineStageError(
                "압축 파일의 압축률이 비정상적으로 높습니다(zip-bomb 의심). "
                f"허용 압축률 {MAX_ZIP_COMPRESSION_RATIO}배 이내여야 합니다: {info.filename}"
            )
        total_uncompressed += info.file_size
        total_compressed += info.compress_size
    if total_uncompressed > MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES:
        raise PipelineStageError(
            "압축 해제 후 전체 크기가 처리 가능 한도를 초과했습니다. "
            f"최대 {MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES} 바이트까지 처리할 수 있습니다."
        )
    if total_compressed > 0 and total_uncompressed / total_compressed > MAX_ZIP_COMPRESSION_RATIO:
        raise PipelineStageError(
            "압축 파일의 전체 압축률이 비정상적으로 높습니다(zip-bomb 의심). "
            f"허용 압축률 {MAX_ZIP_COMPRESSION_RATIO}배 이내여야 합니다."
        )


def _is_supported_archive_member(info: zipfile.ZipInfo) -> bool:
    if _is_unsafe_archive_path(info.filename) or _is_archive_metadata_path(info.filename):
        return False
    lowered = info.filename.lower()
    return lowered.endswith(".json") or lowered.endswith(".jsonl")


def _is_archive_metadata_path(filename: str) -> bool:
    parts = PurePosixPath(filename.replace("\\", "/")).parts
    if any(part == "__MACOSX" for part in parts):
        return True
    return bool(parts) and parts[-1].startswith("._")


def _is_unsafe_archive_path(filename: str) -> bool:
    if not filename or filename.startswith("/") or filename.startswith("\\"):
        return True
    normalized = filename.replace("\\", "/")
    if PurePosixPath(normalized).is_absolute():
        return True
    return any(part == ".." for part in PurePosixPath(normalized).parts)


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
    forbidden_path = _find_forbidden_key(row)
    if forbidden_path is not None:
        raise PipelineStageError(f"Forbidden unavailable metadata found in consultation input: {forbidden_path}")

    turns = _extract_turns(row)
    if not turns:
        return None
    source_id = _first_text(row, ("source_id", "id", "consultation_id", "case_id")) or f"conversation_{index:06d}"
    conversation: dict[str, object] = {
        "id": source_id,
        "dataset_id": dataset_id or str(_first_text(row, ("dataset_id",)) or ""),
        "channel": _first_text(row, ("channel", "source")),
        "ended_status": _first_text(row, ("ended_status", "status")),
        "turns": turns,
    }
    return conversation


def _extract_turns(row: Mapping[str, object]) -> list[dict[str, object]]:
    turns_payload = row.get("turns")
    if isinstance(turns_payload, list):
        turns = _turns_from_payload(turns_payload)
        if turns:
            return turns

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


def _find_forbidden_key(value: object, path: str = "$") -> str | None:
    if isinstance(value, Mapping):
        for key, child in value.items():
            key_text = str(key)
            child_path = f"{path}.{key_text}"
            if key_text in _FORBIDDEN_INPUT_KEYS:
                return child_path
            nested_path = _find_forbidden_key(child, child_path)
            if nested_path is not None:
                return nested_path
    elif isinstance(value, list):
        for index, child in enumerate(value):
            nested_path = _find_forbidden_key(child, f"{path}[{index}]")
            if nested_path is not None:
                return nested_path
    return None


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


def _write_jsonl(path: Path, rows: Iterable[dict[str, object]]) -> int:
    count = 0
    with path.open("w", encoding="utf-8") as output:
        for row in rows:
            output.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
            count += 1
    return count


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
