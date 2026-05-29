from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from pipeline import ecs_embedder_worker
from pipeline.common.runtime import EmbeddingResult


class FakeS3Client:
    def __init__(self, source: Path, uploaded: dict[str, str]) -> None:
        self.source = source
        self.uploaded = uploaded
        self.download_extra_args: dict | None = None
        self.upload_extra_args: dict | None = None

    def download_file(self, _bucket: str, _key: str, filename: str, ExtraArgs: dict | None = None) -> None:
        self.download_extra_args = ExtraArgs
        Path(filename).write_text(self.source.read_text(encoding="utf-8"), encoding="utf-8")

    def upload_file(self, filename: str, bucket: str, key: str, ExtraArgs: dict | None = None) -> None:
        self.upload_extra_args = ExtraArgs
        self.uploaded[f"{bucket}/{key}"] = Path(filename).read_text(encoding="utf-8")


class FakeRuntime:
    model_name = "BAAI/bge-m3"
    runtime_profile = "balanced"

    def __init__(self, *, success: bool = True) -> None:
        self.success = success

    def embed(self, texts: list[str]) -> EmbeddingResult:
        return EmbeddingResult(
            embeddings=np.ones((len(texts), 3), dtype=np.float32),
            success_mask=[self.success and bool(text.strip()) for text in texts],
            model_name=self.model_name,
            runtime_profile=self.runtime_profile,
        )


def set_worker_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("S3_INPUT_BUCKET", "in")
    monkeypatch.setenv("S3_INPUT_KEY", "input.jsonl")
    monkeypatch.setenv("S3_OUTPUT_BUCKET", "out")
    monkeypatch.setenv("S3_OUTPUT_KEY", "output.jsonl")
    monkeypatch.setenv("S3_EXPECTED_BUCKET_OWNER", "123456789012")
    monkeypatch.setenv("GPU_WORKER_TMP_DIR", str(tmp_path / "work"))


def test_run_worker_fails_when_required_s3_env_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("S3_INPUT_BUCKET", raising=False)

    with pytest.raises(ecs_embedder_worker.WorkerError, match="S3_INPUT_BUCKET"):
        ecs_embedder_worker.run_worker()


def test_run_worker_writes_embeddings_to_s3(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    input_file = tmp_path / "input.jsonl"
    input_file.write_text("\n" + json.dumps({"id": "1", "text": "배송 조회"}) + "\n", encoding="utf-8")
    uploaded: dict[str, str] = {}
    s3_client = FakeS3Client(input_file, uploaded)
    set_worker_env(monkeypatch, tmp_path)
    monkeypatch.setattr(ecs_embedder_worker.boto3, "client", lambda _name: s3_client)
    monkeypatch.setattr(ecs_embedder_worker, "_embedding_runtime_from_env", lambda: FakeRuntime())

    assert ecs_embedder_worker.run_worker() == 1

    [line] = uploaded["out/output.jsonl"].splitlines()
    record = json.loads(line)
    assert record["embedding"] == [1.0, 1.0, 1.0]
    assert record["embeddingModelName"] == "BAAI/bge-m3"
    assert record["embeddingRuntimeProfile"] == "balanced"
    assert s3_client.download_extra_args == {"ExpectedBucketOwner": "123456789012"}
    assert s3_client.upload_extra_args == {"ExpectedBucketOwner": "123456789012"}
    assert not list((tmp_path / "work").glob("*.jsonl"))


def test_run_worker_rejects_failed_embedding(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    input_file = tmp_path / "input.jsonl"
    input_file.write_text(json.dumps({"id": "1", "text": "배송 조회"}) + "\n", encoding="utf-8")
    set_worker_env(monkeypatch, tmp_path)
    monkeypatch.setattr(ecs_embedder_worker.boto3, "client", lambda _name: FakeS3Client(input_file, {}))
    monkeypatch.setattr(ecs_embedder_worker, "_embedding_runtime_from_env", lambda: FakeRuntime(success=False))

    with pytest.raises(ecs_embedder_worker.WorkerError, match="Embedding generation failed"):
        ecs_embedder_worker.run_worker()


def test_read_records_rejects_non_object_jsonl(tmp_path: Path) -> None:
    input_file = tmp_path / "input.jsonl"
    input_file.write_text(json.dumps(["bad"]) + "\n", encoding="utf-8")

    with pytest.raises(ecs_embedder_worker.WorkerError, match="records must be objects"):
        ecs_embedder_worker._read_records(input_file)
