from __future__ import annotations

# pyright: reportMissingTypeStubs=false, reportMissingImports=false
import json
import logging
from collections.abc import Iterator, Sequence
from datetime import UTC, datetime
from importlib import import_module
from pathlib import Path
from typing import NotRequired, Protocol, TypedDict, cast

from pipeline.common.artifacts import ensure_stage_directory, write_stage_manifest
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineConfigurationError, PipelineStageError
from pipeline.stages.preprocessing.types import Conversation, ConversationTurn, ProcessedConversation

logger = logging.getLogger(__name__)

DEFAULT_INGESTION_ARTIFACT_NAME = "conversations.jsonl"
DEFAULT_SOURCE_MANIFEST = "ingestion/manifest.json"


class ManifestPayload(TypedDict, total=False):
    artifact_path: str


class Manifest(TypedDict, total=False):
    dag_id: str
    run_id: str
    workspace_id: str | None
    dataset_id: str | None
    pipeline_job_id: str | None
    payload: ManifestPayload


class IngestionTurnPayload(TypedDict):
    turn_index: int
    speaker_role: str
    message_text: str


class IngestionConversationPayload(TypedDict):
    id: str
    dataset_id: str
    turns: list[IngestionTurnPayload]
    channel: NotRequired[str | None]
    ended_status: NotRequired[str | None]


class JsonObject(TypedDict, total=False):
    schema_version: str
    stage: str
    generated_at: str
    source_manifest: str
    conversations: list[dict[str, object]]
    stats: dict[str, object]


class OrjsonLike(Protocol):
    OPT_INDENT_2: int

    def dumps(self, obj: object, /, *, option: int = 0) -> bytes: ...


def read_stage_context(upstream_manifest_path: str | None, stage_name: str) -> StageContext:
    manifest_path = _require_manifest_path(upstream_manifest_path)

    try:
        manifest = _load_manifest(manifest_path)
    except OSError as exc:
        raise PipelineStageError(f"Failed to read upstream manifest for stage context: {manifest_path}") from exc
    except json.JSONDecodeError as exc:
        raise PipelineStageError(f"Invalid upstream manifest JSON for stage context: {manifest_path}") from exc

    return StageContext(
        dag_id=_required_manifest_str(manifest, "dag_id", manifest_path),
        run_id=_required_manifest_str(manifest, "run_id", manifest_path),
        stage_name=stage_name,
        workspace_id=_optional_str(manifest.get("workspace_id")),
        dataset_id=_optional_str(manifest.get("dataset_id")),
        pipeline_job_id=_optional_str(manifest.get("pipeline_job_id")),
    )


def read_ingestion_artifact(upstream_manifest_path: str | None) -> Iterator[Conversation]:
    manifest_path = _require_manifest_path(upstream_manifest_path)

    try:
        manifest = _load_manifest(manifest_path)
    except OSError as exc:
        raise PipelineStageError(f"Failed to read ingestion manifest: {manifest_path}") from exc
    except json.JSONDecodeError as exc:
        raise PipelineStageError(f"Invalid ingestion manifest JSON: {manifest_path}") from exc

    artifact_path = _resolve_artifact_path(manifest_path, manifest)

    try:
        yield from _iter_conversations(artifact_path)
    except OSError as exc:
        raise PipelineStageError(f"Failed to read ingestion artifact: {artifact_path}") from exc


def write_preprocessed_artifact(
    stage_context: StageContext,
    runtime_config: PipelineRuntimeConfig,
    processed: Sequence[ProcessedConversation],
    stats: dict[str, object],
) -> dict[str, str]:
    output_dir = ensure_stage_directory(stage_context, runtime_config)

    output_path = output_dir / "preprocessed_conversations.json"
    output: JsonObject = {
        "schema_version": "1.0",
        "stage": "preprocessing",
        "generated_at": _utc_now_isoformat(),
        "source_manifest": _resolve_source_manifest(stats),
        "conversations": [_serialize_processed_conversation(conversation) for conversation in processed],
        "stats": stats,
    }

    orjson_module = _load_orjson_module()
    if orjson_module is not None:
        json_bytes = orjson_module.dumps(output, option=orjson_module.OPT_INDENT_2)
        _ = output_path.write_bytes(json_bytes)
    else:
        _ = output_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")

    manifest_path = write_stage_manifest(
        stage_context,
        runtime_config,
        {
            "artifact_path": output_path.name,
        },
    )
    return {"artifact_manifest_path": str(manifest_path.resolve())}


def _load_manifest(manifest_path: Path) -> Manifest:
    manifest_data = json.loads(manifest_path.read_text(encoding="utf-8"))  # pyright: ignore[reportAny]
    if not isinstance(manifest_data, dict):
        raise PipelineStageError(f"Ingestion manifest must be a JSON object: {manifest_path}")
    return cast(Manifest, cast(object, manifest_data))


def _require_manifest_path(upstream_manifest_path: str | None) -> Path:
    if upstream_manifest_path is None:
        raise PipelineConfigurationError("upstream_manifest_path must not be None.")
    return Path(upstream_manifest_path)


def _required_manifest_str(manifest: Manifest, key: str, manifest_path: Path) -> str:
    value = manifest.get(key)
    if isinstance(value, str) and value:
        return value
    raise PipelineStageError(f"Manifest field {key!r} must be a non-empty string: {manifest_path}")


def _resolve_artifact_path(manifest_path: Path, manifest: Manifest) -> Path:
    payload = manifest.get("payload")
    artifact_path = payload.get("artifact_path") if payload is not None else None

    if not artifact_path:
        return manifest_path.parent / DEFAULT_INGESTION_ARTIFACT_NAME

    artifact = Path(artifact_path)
    if artifact.is_absolute():
        return artifact
    return manifest_path.parent / artifact


def _iter_conversations(artifact_path: Path) -> Iterator[Conversation]:
    success_count = 0

    with artifact_path.open("r", encoding="utf-8") as artifact_file:
        for line_number, raw_line in enumerate(artifact_file, start=1):
            line = raw_line.strip()
            if not line:
                continue

            try:
                payload = _load_conversation_payload(line)
                conversation = _build_conversation(payload)
            except (json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
                logger.warning("Skipping invalid ingestion line %s: %s", line_number, exc)
                continue

            success_count += 1
            yield conversation

    if success_count == 0:
        raise PipelineStageError(f"All ingestion artifact lines failed to parse: {artifact_path}")


def _load_conversation_payload(line: str) -> IngestionConversationPayload:
    payload_data = json.loads(line)  # pyright: ignore[reportAny]
    if not isinstance(payload_data, dict):
        raise TypeError("conversation payload must be an object.")
    return cast(IngestionConversationPayload, cast(object, payload_data))


def _build_conversation(payload: IngestionConversationPayload) -> Conversation:
    turns_payload = payload["turns"]

    turns = tuple(_build_turn(turn_payload) for turn_payload in turns_payload)

    return Conversation(
        conversation_id=str(payload["id"]),
        dataset_id=str(payload["dataset_id"]),
        channel=_optional_str(payload.get("channel")),
        ended_status=_optional_str(payload.get("ended_status")),
        turns=turns,
    )


def _build_turn(payload: IngestionTurnPayload) -> ConversationTurn:
    turn_index = payload["turn_index"]
    return ConversationTurn(
        turn_id=f"turn_{turn_index}",
        speaker_role=str(payload["speaker_role"]),
        text=str(payload["message_text"]),
        timestamp=None,
    )


def _optional_str(value: object) -> str | None:
    if value is None:
        return None
    return str(value)


def _serialize_processed_conversation(conversation: ProcessedConversation) -> dict[str, object]:
    return {
        "id": conversation.id,
        "dataset_id": conversation.dataset_id,
        "channel": conversation.channel,
        "ended_status": conversation.ended_status,
        "canonical_text": conversation.canonical_text,
        "customer_problem_text": conversation.customer_problem_text,
        "flow_signature": [float(value) for value in conversation.flow_signature],
        "flow_signature_dim": conversation.flow_signature_dim,
        "turn_count": conversation.turn_count,
        "customer_turn_count": conversation.customer_turn_count,
        "pii_mask_count": conversation.pii_mask_count,
        "filtered": conversation.filtered,
    }


def _resolve_source_manifest(stats: dict[str, object]) -> str:
    source_manifest = stats.get("source_manifest") or stats.get("upstream_manifest_path")
    if isinstance(source_manifest, str) and source_manifest:
        return source_manifest
    return DEFAULT_SOURCE_MANIFEST


def _load_orjson_module() -> OrjsonLike | None:
    try:
        module: object = import_module("orjson")
        return cast(OrjsonLike, cast(object, module))
    except ImportError:
        return None


def _utc_now_isoformat() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
