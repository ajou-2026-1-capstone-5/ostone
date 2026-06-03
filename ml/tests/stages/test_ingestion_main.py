from __future__ import annotations

import json
import zipfile
from pathlib import Path
from typing import Any, cast

import pytest

from pipeline.common.exceptions import PipelineConfigurationError, PipelineStageError
from pipeline.stages.ingestion import main as ingestion


def test_parse_raw_payload_reads_json_conversations_with_turn_payloads() -> None:
    raw_bytes = json.dumps(
        {
            "conversations": [
                {
                    "id": "consult-1",
                    "channel": "kakao",
                    "status": "resolved",
                    "turns": [
                        {"speaker": "상담사", "text": "안녕하세요"},
                        {"speaker": "고객", "text": "예약 가능할까요?"},
                        "추가로 견적도 궁금합니다",
                    ],
                }
            ]
        },
        ensure_ascii=False,
    ).encode()

    conversations = list(ingestion._parse_raw_payload(raw_bytes, "dataset-1"))

    assert conversations == [
        {
            "id": "consult-1",
            "dataset_id": "dataset-1",
            "channel": "kakao",
            "ended_status": "resolved",
            "turns": [
                {"turn_index": 0, "speaker_role": ingestion.AGENT_ROLE, "message_text": "안녕하세요"},
                {"turn_index": 1, "speaker_role": ingestion.CUSTOMER_ROLE, "message_text": "예약 가능할까요?"},
                {"turn_index": 2, "speaker_role": ingestion.CUSTOMER_ROLE, "message_text": "추가로 견적도 궁금합니다"},
            ],
        }
    ]


def test_parse_raw_payload_reads_parsed_consultation_dataset_contract() -> None:
    raw_bytes = json.dumps(
        [
            {
                "source_id": "case-1",
                "turns": [
                    {"turn_index": 0, "speaker_role": "CUSTOMER", "message_text": "예약 가능한가요?"},
                    {"turn_index": 1, "speaker_role": "AGENT", "message_text": "가능합니다"},
                ],
            }
        ],
        ensure_ascii=False,
    ).encode()

    conversations = list(ingestion._parse_raw_payload(raw_bytes, "dataset-1"))

    assert conversations == [
        {
            "id": "case-1",
            "dataset_id": "dataset-1",
            "channel": None,
            "ended_status": None,
            "turns": [
                {"turn_index": 0, "speaker_role": ingestion.CUSTOMER_ROLE, "message_text": "예약 가능한가요?"},
                {"turn_index": 1, "speaker_role": ingestion.AGENT_ROLE, "message_text": "가능합니다"},
            ],
        }
    ]


def test_parse_raw_payload_reads_parsed_consultation_zip_archive(tmp_path: Path) -> None:
    zip_path = tmp_path / "parsed.zip"
    with zipfile.ZipFile(zip_path, "w") as archive:
        archive.writestr(
            "001.json",
            json.dumps(
                [
                    {
                        "source_id": "case-1",
                        "turns": [
                            {"turn_index": 0, "speaker_role": "CUSTOMER", "message_text": "예약 가능한가요?"},
                            {"turn_index": 1, "speaker_role": "AGENT", "message_text": "가능합니다"},
                        ],
                    }
                ],
                ensure_ascii=False,
            ),
        )

    conversations = list(ingestion._parse_raw_payload(zip_path.read_bytes(), "dataset-1"))

    assert len(conversations) == 1
    assert conversations[0]["id"] == "case-1"
    assert conversations[0]["turns"] == [
        {"turn_index": 0, "speaker_role": ingestion.CUSTOMER_ROLE, "message_text": "예약 가능한가요?"},
        {"turn_index": 1, "speaker_role": ingestion.AGENT_ROLE, "message_text": "가능합니다"},
    ]


def test_parse_raw_payload_rejects_unavailable_consulting_category_metadata() -> None:
    raw_bytes = json.dumps(
        [
            {
                "source_id": "case-1",
                "consulting_category": "test-only-label",
                "turns": [{"turn_index": 0, "speaker_role": "CUSTOMER", "message_text": "문의합니다"}],
            }
        ],
        ensure_ascii=False,
    ).encode()

    with pytest.raises(PipelineStageError, match="Forbidden unavailable metadata"):
        list(ingestion._parse_raw_payload(raw_bytes, "dataset-1"))


def test_parse_raw_payload_reads_legacy_jsonl_and_consulting_content() -> None:
    rows = [
        {
            "consultation_id": "case-1",
            "dataset_id": "fallback-ds",
            "consulting_content": "고객님: 예약 가능한가요?\n상담사 - 가능합니다\nC) 감사합니다",
        },
        {
            "case_id": "case-2",
            "content": "Agent: 출발일을 알려주세요\nCustomer: 다음 주입니다",
        },
    ]
    raw_bytes = "\n".join(json.dumps(row, ensure_ascii=False) for row in rows).encode()

    conversations = list(ingestion._parse_raw_payload(raw_bytes, None))

    assert [conversation["id"] for conversation in conversations] == ["case-1", "case-2"]
    assert conversations[0]["dataset_id"] == "fallback-ds"
    assert conversations[0]["turns"] == [
        {"turn_index": 0, "speaker_role": ingestion.CUSTOMER_ROLE, "message_text": "예약 가능한가요?"},
        {"turn_index": 1, "speaker_role": ingestion.AGENT_ROLE, "message_text": "가능합니다"},
        {"turn_index": 2, "speaker_role": ingestion.CUSTOMER_ROLE, "message_text": "감사합니다"},
    ]
    case_2_turns = cast(list[dict[str, object]], conversations[1]["turns"])
    assert case_2_turns[0]["speaker_role"] == ingestion.AGENT_ROLE


def test_parse_raw_payload_falls_back_when_turns_payload_is_empty() -> None:
    raw_bytes = json.dumps(
        {
            "id": "case-with-empty-turns",
            "turns": [],
            "content": "고객: 출발 시간 알려주세요\n상담사: 오전 9시 출발입니다",
        },
        ensure_ascii=False,
    ).encode()

    conversations = list(ingestion._parse_raw_payload(raw_bytes, "dataset-1"))

    assert len(conversations) == 1
    assert conversations[0]["turns"] == [
        {"turn_index": 0, "speaker_role": ingestion.CUSTOMER_ROLE, "message_text": "출발 시간 알려주세요"},
        {"turn_index": 1, "speaker_role": ingestion.AGENT_ROLE, "message_text": "오전 9시 출발입니다"},
    ]


def test_parse_raw_payload_skips_rows_without_turns() -> None:
    raw_bytes = json.dumps([{"id": "empty", "content": "   "}]).encode()

    assert list(ingestion._parse_raw_payload(raw_bytes, "dataset-1")) == []


def test_load_json_or_jsonl_rejects_invalid_jsonl() -> None:
    with pytest.raises(PipelineStageError, match="Invalid JSONL line"):
        ingestion._load_json_or_jsonl('{"ok": true}\nnot-json')


def test_extract_rows_rejects_scalar_payload() -> None:
    with pytest.raises(PipelineStageError, match="JSON object, JSON array, or JSONL"):
        ingestion._extract_rows("invalid")


def test_resolve_runtime_context_uses_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AIRFLOW_DAG_ID", "dag-env")
    monkeypatch.setenv("AIRFLOW_RUN_ID", "run-env")
    monkeypatch.setenv("PIPELINE_WORKSPACE_ID", " workspace-1 ")
    monkeypatch.setenv("PIPELINE_DATASET_ID", "dataset-1")
    monkeypatch.setenv("PIPELINE_JOB_ID", "job-1")
    monkeypatch.setenv("PIPELINE_RAW_OBJECT_KEY", " raw/object.json ")
    monkeypatch.setattr(ingestion, "_load_airflow_context", lambda: {})

    runtime_context = ingestion._resolve_runtime_context()

    assert runtime_context.object_key == "raw/object.json"
    assert runtime_context.stage_context.dag_id == "dag-env"
    assert runtime_context.stage_context.run_id == "run-env"
    assert runtime_context.stage_context.workspace_id == "workspace-1"
    assert runtime_context.stage_context.dataset_id == "dataset-1"
    assert runtime_context.stage_context.pipeline_job_id == "job-1"


def test_resolve_runtime_context_accepts_airflow_camel_case_object_key(monkeypatch: pytest.MonkeyPatch) -> None:
    class DagRun:
        conf = {"objectKey": " raw/camel-case.json "}

    monkeypatch.delenv("PIPELINE_RAW_OBJECT_KEY", raising=False)
    monkeypatch.setattr(ingestion, "_load_airflow_context", lambda: {"dag_run": DagRun()})

    runtime_context = ingestion._resolve_runtime_context()

    assert runtime_context.object_key == "raw/camel-case.json"


def test_resolve_runtime_context_requires_object_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("PIPELINE_RAW_OBJECT_KEY", raising=False)
    monkeypatch.setattr(ingestion, "_load_airflow_context", lambda: {})

    with pytest.raises(PipelineConfigurationError, match="object_key"):
        ingestion._resolve_runtime_context()


def test_context_value_prefers_conf_then_params_then_dag_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    class DagRun:
        conf = {"workspace_id": "ws-conf"}

    class Dag:
        dag_id = "dag-from-object"

    context = {
        "dag_run": DagRun(),
        "params": {"workspace_id": "ws-param", "dataset_id": "ds-param"},
        "dag": Dag(),
        "run_id": "run-from-context",
    }
    monkeypatch.setenv("PIPELINE_DATASET_ID", "ds-env")

    assert ingestion._context_value(context, "workspace_id", "PIPELINE_WORKSPACE_ID", None) == "ws-conf"
    assert ingestion._context_value(context, "dataset_id", "PIPELINE_DATASET_ID", None) == "ds-param"
    assert ingestion._context_value(context, "dag_id", "AIRFLOW_DAG_ID", None) == "dag-from-object"
    assert ingestion._context_value(context, "run_id", "AIRFLOW_RUN_ID", None) == "run-from-context"


def test_s3_client_uses_endpoint_credentials_and_path_style(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, Any] = {}

    def fake_client(**kwargs: Any) -> object:
        captured.update(kwargs)
        return object()

    monkeypatch.setattr(ingestion.boto3, "client", fake_client)
    monkeypatch.setenv("STORAGE_S3_ENDPOINT", "http://localhost:9000")
    monkeypatch.setenv("STORAGE_S3_ACCESS_KEY", "access")
    monkeypatch.setenv("STORAGE_S3_SECRET_KEY", "secret")
    monkeypatch.setenv("STORAGE_S3_REGION", "ap-northeast-2")
    monkeypatch.setenv("STORAGE_S3_PATH_STYLE", "true")

    ingestion._s3_client()

    assert captured["service_name"] == "s3"
    assert captured["endpoint_url"] == "http://localhost:9000"
    assert captured["aws_access_key_id"] == "access"
    assert captured["aws_secret_access_key"] == "secret"
    assert captured["config"].s3["addressing_style"] == "path"


def test_read_raw_object_streams_body_to_scratch_file(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    class Body:
        def __init__(self) -> None:
            self._chunks = iter([b"pay", b"load", b""])

        def read(self, _size: int) -> bytes:
            return next(self._chunks)

    class Client:
        def get_object(self, **kwargs: Any) -> dict[str, object]:
            assert kwargs == {"Bucket": "bucket", "Key": "raw.json"}
            return {"Body": Body()}

    monkeypatch.setenv("STORAGE_S3_BUCKET", "bucket")
    monkeypatch.setenv("PIPELINE_SCRATCH_DIR", str(tmp_path))
    monkeypatch.setattr(ingestion, "_s3_client", lambda: Client())

    raw_path = ingestion._read_raw_object("raw.json")
    try:
        assert raw_path.parent == tmp_path
        assert raw_path.read_bytes() == b"payload"
    finally:
        raw_path.unlink(missing_ok=True)


def test_read_raw_object_rejects_oversized_object(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    class Body:
        def __init__(self) -> None:
            self._chunks = iter([b"a" * 8, b"b" * 8, b""])

        def read(self, _size: int) -> bytes:
            return next(self._chunks)

    class Client:
        def get_object(self, **_kwargs: Any) -> dict[str, object]:
            return {"Body": Body()}

    monkeypatch.setenv("STORAGE_S3_BUCKET", "bucket")
    monkeypatch.setenv("PIPELINE_SCRATCH_DIR", str(tmp_path))
    monkeypatch.setattr(ingestion, "MAX_RAW_OBJECT_BYTES", 10)
    monkeypatch.setattr(ingestion, "_s3_client", lambda: Client())

    with pytest.raises(PipelineStageError, match="업로드 파일 크기"):
        ingestion._read_raw_object("raw.json")

    assert list(tmp_path.iterdir()) == []


def test_read_raw_object_wraps_s3_errors(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    class Client:
        def get_object(self, **_kwargs: Any) -> dict[str, object]:
            raise RuntimeError("boom")

    monkeypatch.setenv("STORAGE_S3_BUCKET", "bucket")
    monkeypatch.setenv("PIPELINE_SCRATCH_DIR", str(tmp_path))
    monkeypatch.setattr(ingestion, "_s3_client", lambda: Client())

    with pytest.raises(PipelineStageError, match="Failed to read raw object"):
        ingestion._read_raw_object("raw.json")

    assert list(tmp_path.iterdir()) == []


def test_run_writes_conversations_and_manifest(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    raw_bytes = json.dumps(
        {"id": "consult-1", "turns": [{"speaker": "고객", "text": "예약 가능 여부 확인 부탁드립니다"}]},
        ensure_ascii=False,
    ).encode()
    raw_path = tmp_path / "raw.json"
    raw_path.write_bytes(raw_bytes)
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(tmp_path / "artifacts"))
    monkeypatch.setenv("PIPELINE_RAW_OBJECT_KEY", "raw.json")
    monkeypatch.setenv("PIPELINE_WORKSPACE_ID", "workspace-1")
    monkeypatch.setenv("PIPELINE_DATASET_ID", "dataset-1")
    monkeypatch.setattr(ingestion, "_load_airflow_context", lambda: {})
    monkeypatch.setattr(ingestion, "_read_raw_object", lambda object_key: raw_path)

    result = ingestion.run()

    manifest_path = Path(result["artifact_manifest_path"])
    output_path = manifest_path.parent / ingestion.DEFAULT_INGESTION_ARTIFACT_NAME
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    rows = [json.loads(line) for line in output_path.read_text(encoding="utf-8").splitlines()]

    assert manifest["payload"]["conversation_count"] == 1
    assert manifest["payload"]["object_key"] == "raw.json"
    assert rows[0]["id"] == "consult-1"
    assert not raw_path.exists()


def _conversation_row(source_id: str) -> dict[str, object]:
    return {
        "source_id": source_id,
        "turns": [{"turn_index": 0, "speaker_role": "CUSTOMER", "message_text": "문의합니다"}],
    }


def _write_zip(zip_path: Path, members: dict[str, str], *, compression: int = zipfile.ZIP_DEFLATED) -> None:
    with zipfile.ZipFile(zip_path, "w", compression=compression) as archive:
        for name, content in members.items():
            archive.writestr(name, content)


def test_parse_raw_payload_streams_zip_members_into_conversations(tmp_path: Path) -> None:
    zip_path = tmp_path / "parsed.zip"
    _write_zip(
        zip_path,
        {
            "002.json": json.dumps([_conversation_row("case-2")], ensure_ascii=False),
            "001.json": json.dumps([_conversation_row("case-1")], ensure_ascii=False),
        },
    )

    conversations = list(ingestion._parse_raw_payload(zip_path, "dataset-1"))

    assert [conversation["id"] for conversation in conversations] == ["case-1", "case-2"]


def test_write_jsonl_streams_conversations_and_reports_count(tmp_path: Path) -> None:
    output_path = tmp_path / "conversations.jsonl"

    def rows() -> Any:
        yield {"id": "a"}
        yield {"id": "b"}

    count = ingestion._write_jsonl(output_path, rows())

    assert count == 2
    lines = output_path.read_text(encoding="utf-8").splitlines()
    assert [json.loads(line)["id"] for line in lines] == ["a", "b"]


def test_parse_raw_payload_rejects_zip_with_too_many_entries(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(ingestion, "MAX_ZIP_ENTRY_COUNT", 1)
    zip_path = tmp_path / "parsed.zip"
    _write_zip(
        zip_path,
        {
            "001.json": json.dumps([_conversation_row("case-1")], ensure_ascii=False),
            "002.json": json.dumps([_conversation_row("case-2")], ensure_ascii=False),
        },
    )

    with pytest.raises(PipelineStageError, match="항목 수"):
        list(ingestion._parse_raw_payload(zip_path, "dataset-1"))


def test_parse_raw_payload_rejects_zip_entry_over_size_limit(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(ingestion, "MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES", 16)
    zip_path = tmp_path / "parsed.zip"
    _write_zip(
        zip_path,
        {"001.json": json.dumps([_conversation_row("case-1")], ensure_ascii=False)},
    )

    with pytest.raises(PipelineStageError, match="단일 항목 크기"):
        list(ingestion._parse_raw_payload(zip_path, "dataset-1"))


def test_parse_raw_payload_rejects_zip_over_total_uncompressed_limit(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(ingestion, "MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES", 8)
    monkeypatch.setattr(ingestion, "MAX_ZIP_COMPRESSION_RATIO", 10_000)
    zip_path = tmp_path / "parsed.zip"
    _write_zip(
        zip_path,
        {
            "001.json": json.dumps([_conversation_row("case-1")], ensure_ascii=False),
            "002.json": json.dumps([_conversation_row("case-2")], ensure_ascii=False),
        },
    )

    with pytest.raises(PipelineStageError, match="전체 크기"):
        list(ingestion._parse_raw_payload(zip_path, "dataset-1"))


def test_parse_raw_payload_rejects_zip_with_excessive_compression_ratio(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(ingestion, "MAX_ZIP_COMPRESSION_RATIO", 5)
    monkeypatch.setattr(ingestion, "MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES", 10 * 1024 * 1024)
    monkeypatch.setattr(ingestion, "MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES", 10 * 1024 * 1024)
    zip_path = tmp_path / "bomb.zip"
    # Highly repetitive payload compresses far beyond the allowed ratio.
    highly_compressible = json.dumps([_conversation_row("a" * 200_000)], ensure_ascii=False)
    _write_zip(zip_path, {"001.json": highly_compressible})

    with pytest.raises(PipelineStageError, match="압축률"):
        list(ingestion._parse_raw_payload(zip_path, "dataset-1"))


def test_parse_raw_payload_ignores_zip_slip_and_metadata_entries(tmp_path: Path) -> None:
    zip_path = tmp_path / "parsed.zip"
    _write_zip(
        zip_path,
        {
            "../escape.json": json.dumps([_conversation_row("escaped")], ensure_ascii=False),
            "__MACOSX/._001.json": "garbage",
            "notes.txt": "not a conversation",
            "001.json": json.dumps([_conversation_row("case-1")], ensure_ascii=False),
        },
    )

    conversations = list(ingestion._parse_raw_payload(zip_path, "dataset-1"))

    assert [conversation["id"] for conversation in conversations] == ["case-1"]


def test_parse_raw_payload_rejects_when_conversation_count_exceeds_limit(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(ingestion, "MAX_INGESTION_CONVERSATIONS", 2)
    payload = json.dumps(
        [_conversation_row(f"case-{index}") for index in range(3)],
        ensure_ascii=False,
    )
    zip_path = tmp_path / "parsed.zip"
    _write_zip(zip_path, {"001.json": payload})

    with pytest.raises(PipelineStageError, match="처리 가능 상담 건수"):
        list(ingestion._parse_raw_payload(zip_path, "dataset-1"))


def test_run_rejects_oversized_dataset_and_cleans_scratch_file(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(ingestion, "MAX_INGESTION_CONVERSATIONS", 1)
    raw_path = tmp_path / "raw.json"
    raw_path.write_text(
        json.dumps([_conversation_row("case-1"), _conversation_row("case-2")], ensure_ascii=False),
        encoding="utf-8",
    )
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(tmp_path / "artifacts"))
    monkeypatch.setenv("PIPELINE_RAW_OBJECT_KEY", "raw.json")
    monkeypatch.setenv("PIPELINE_DATASET_ID", "dataset-1")
    monkeypatch.setattr(ingestion, "_load_airflow_context", lambda: {})
    monkeypatch.setattr(ingestion, "_read_raw_object", lambda object_key: raw_path)

    with pytest.raises(PipelineStageError, match="처리 가능 상담 건수"):
        ingestion.run()

    assert not raw_path.exists()
