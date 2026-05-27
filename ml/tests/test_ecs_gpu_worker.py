from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from pipeline import ecs_gpu_worker


class FakeS3Client:
    def __init__(self, source: Path, uploaded: dict[str, str]) -> None:
        self.source = source
        self.uploaded = uploaded

    def download_file(self, _bucket: str, _key: str, filename: str, ExtraArgs: dict | None = None) -> None:
        Path(filename).write_text(self.source.read_text())

    def upload_file(self, filename: str, bucket: str, key: str, ExtraArgs: dict | None = None) -> None:
        self.uploaded[f"{bucket}/{key}"] = Path(filename).read_text()


def test_main_fails_when_omlx_api_key_missing(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    input_file = tmp_path / "input.jsonl"
    input_file.write_text(json.dumps({"text": "hello"}) + "\n")
    monkeypatch.setenv("S3_INPUT_BUCKET", "in")
    monkeypatch.setenv("S3_INPUT_KEY", "input.jsonl")
    monkeypatch.setenv("S3_OUTPUT_BUCKET", "out")
    monkeypatch.setenv("S3_OUTPUT_KEY", "output.jsonl")
    monkeypatch.delenv("OMLX_API_KEY", raising=False)
    monkeypatch.setattr(ecs_gpu_worker.boto3, "client", lambda _name: FakeS3Client(input_file, {}))

    with pytest.raises(SystemExit) as exc_info:
        ecs_gpu_worker.main()

    assert exc_info.value.code == 1


def test_main_writes_embeddings_to_s3(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    input_file = tmp_path / "input.jsonl"
    input_file.write_text(json.dumps({"id": "1", "text": "hello"}) + "\n")
    uploaded: dict[str, str] = {}
    monkeypatch.setenv("S3_INPUT_BUCKET", "in")
    monkeypatch.setenv("S3_INPUT_KEY", "input.jsonl")
    monkeypatch.setenv("S3_OUTPUT_BUCKET", "out")
    monkeypatch.setenv("S3_OUTPUT_KEY", "output.jsonl")
    monkeypatch.setenv("OMLX_API_KEY", "secret")
    monkeypatch.setattr(ecs_gpu_worker.boto3, "client", lambda _name: FakeS3Client(input_file, uploaded))
    monkeypatch.setattr(
        ecs_gpu_worker,
        "embed_texts_omlx",
        lambda texts, _base_url, _api_key, _model_name: [np.ones(3, dtype=np.float32) for _ in texts],
    )

    with pytest.raises(SystemExit) as exc_info:
        ecs_gpu_worker.main()

    assert exc_info.value.code == 0
    [line] = uploaded["out/output.jsonl"].splitlines()
    assert json.loads(line)["embedding"] == [1.0, 1.0, 1.0]
