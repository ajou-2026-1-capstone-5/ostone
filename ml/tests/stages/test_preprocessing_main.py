from __future__ import annotations

import json

# pyright: reportMissingTypeStubs=false
from collections.abc import Iterator
from pathlib import Path
from typing import TypedDict, cast

import pytest

from pipeline.stages.preprocessing.main import run
from pipeline.stages.preprocessing.types import Conversation


class OutputConversation(TypedDict):
    id: str
    flow_signature_dim: int
    flow_signature: list[float]
    canonical_text: str
    customer_problem_text: str
    filtered: bool


class OutputStats(TypedDict):
    input_count: int
    output_count: int


class OutputArtifact(TypedDict):
    conversations: list[OutputConversation]
    stats: OutputStats


def _write_manifest(tmp_path: Path, artifact_path: Path) -> Path:
    manifest_path = tmp_path / "manifest.json"
    _ = manifest_path.write_text(
        json.dumps(
            {
                "dag_id": "test",
                "run_id": "r1",
                "stage_name": "ingestion",
                "payload": {"artifact_path": str(artifact_path)},
            }
        ),
        encoding="utf-8",
    )
    return manifest_path


def _read_output(output_path: Path) -> OutputArtifact:
    return cast(OutputArtifact, json.loads(output_path.read_text(encoding="utf-8")))


def _empty_conversations(_path: str | None) -> Iterator[Conversation]:
    return iter(())


def test_should_write_output_for_empty_input(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """입력 conversation이 비어 있어도 전처리 결과 artifact를 기록하는지 확인한다."""

    artifact_root = tmp_path / "artifacts"
    conversations_path = tmp_path / "conversations.jsonl"
    _ = conversations_path.write_text("", encoding="utf-8")
    manifest_path = _write_manifest(tmp_path, conversations_path)

    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    monkeypatch.setattr("pipeline.stages.preprocessing.main.read_ingestion_artifact", _empty_conversations)

    output_path = run(str(manifest_path))
    output = _read_output(output_path)

    assert output_path.exists()
    assert output["stats"]["input_count"] == 0


def test_should_process_single_conversation(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """정상 ingestion artifact 한 건을 전처리 artifact로 변환하는지 확인한다."""

    artifact_root = tmp_path / "artifacts"
    conversations_path = tmp_path / "conversations.jsonl"
    manifest_path = _write_manifest(tmp_path, conversations_path)
    _ = conversations_path.write_text(
        json.dumps(
            {
                "id": "c1",
                "dataset_id": "ds1",
                "channel": "chat",
                "ended_status": "resolved",
                "turns": [
                    {
                        "turn_index": 0,
                        "speaker_role": "CUSTOMER",
                        "message_text": "주문 환불 요청합니다 불편해서 문제 해결 필요",
                    },
                    {
                        "turn_index": 1,
                        "speaker_role": "AGENT",
                        "message_text": "처리 완료",
                    },
                ],
            }
        )
        + "\n",
        encoding="utf-8",
    )

    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")

    output_path = run(str(manifest_path))
    output = _read_output(output_path)
    conversation = output["conversations"][0]

    assert output_path.exists()
    assert output["stats"]["input_count"] == 1
    assert output["stats"]["output_count"] == 1
    assert conversation["id"] == "c1"
    assert conversation["flow_signature_dim"] == 61
    assert len(conversation["flow_signature"]) == 61
    assert isinstance(conversation["canonical_text"], str)
    assert isinstance(conversation["customer_problem_text"], str)
    assert conversation["filtered"] is False


def test_should_filter_short_conversations(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """canonical text가 너무 짧은 conversation은 출력에서 제외하는지 확인한다."""

    artifact_root = tmp_path / "artifacts"
    conversations_path = tmp_path / "conversations.jsonl"
    manifest_path = _write_manifest(tmp_path, conversations_path)
    _ = conversations_path.write_text(
        json.dumps(
            {
                "id": "c_short",
                "dataset_id": "ds1",
                "channel": "chat",
                "ended_status": "resolved",
                "turns": [
                    {
                        "turn_index": 0,
                        "speaker_role": "AGENT",
                        "message_text": "네",
                    }
                ],
            }
        )
        + "\n",
        encoding="utf-8",
    )

    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")

    output_path = run(str(manifest_path))
    output = _read_output(output_path)

    assert output["stats"]["input_count"] == 1
    assert output["stats"]["output_count"] == 0
