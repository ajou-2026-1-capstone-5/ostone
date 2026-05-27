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
        self.download_extra_args: dict | None = None
        self.upload_extra_args: dict | None = None

    def download_file(self, _bucket: str, _key: str, filename: str, ExtraArgs: dict | None = None) -> None:
        self.download_extra_args = ExtraArgs
        Path(filename).write_text(self.source.read_text())

    def upload_file(self, filename: str, bucket: str, key: str, ExtraArgs: dict | None = None) -> None:
        self.upload_extra_args = ExtraArgs
        self.uploaded[f"{bucket}/{key}"] = Path(filename).read_text()


class FakeResponse:
    def __init__(self, payload: dict) -> None:
        self.payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self.payload


class FakeHttpClient:
    def __init__(self, *args: object, **kwargs: object) -> None:
        self.posts: list[dict] = []

    def __enter__(self) -> FakeHttpClient:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def post(self, path: str, json: dict) -> FakeResponse:
        self.posts.append({"path": path, "json": json})
        payload = {"data": [{"embedding": [float(index)]} for index, _ in enumerate(json["input"])]}
        return FakeResponse(payload)


def set_worker_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("S3_INPUT_BUCKET", "in")
    monkeypatch.setenv("S3_INPUT_KEY", "input.jsonl")
    monkeypatch.setenv("S3_OUTPUT_BUCKET", "out")
    monkeypatch.setenv("S3_OUTPUT_KEY", "output.jsonl")
    monkeypatch.setenv("S3_EXPECTED_BUCKET_OWNER", "123456789012")
    monkeypatch.setenv("GPU_WORKER_TMP_DIR", str(tmp_path / "work"))


def test_run_worker_fails_when_omlx_api_key_missing(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    input_file = tmp_path / "input.jsonl"
    input_file.write_text(json.dumps({"text": "hello"}) + "\n")
    set_worker_env(monkeypatch, tmp_path)
    monkeypatch.delenv("OMLX_API_KEY", raising=False)
    monkeypatch.setattr(ecs_gpu_worker.boto3, "client", lambda _name: FakeS3Client(input_file, {}))

    with pytest.raises(ecs_gpu_worker.WorkerError, match="OMLX_API_KEY"):
        ecs_gpu_worker.run_worker()


def test_run_worker_writes_embeddings_to_s3(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    input_file = tmp_path / "input.jsonl"
    input_file.write_text("\n" + json.dumps({"id": "1", "text": "hello"}) + "\n")
    uploaded: dict[str, str] = {}
    s3_client = FakeS3Client(input_file, uploaded)
    set_worker_env(monkeypatch, tmp_path)
    monkeypatch.setenv("OMLX_API_KEY", "secret")
    monkeypatch.setattr(ecs_gpu_worker.boto3, "client", lambda _name: s3_client)
    monkeypatch.setattr(
        ecs_gpu_worker,
        "embed_texts_omlx",
        lambda texts, _base_url, _api_key, _model_name: [np.ones(3, dtype=np.float32) for _ in texts],
    )

    assert ecs_gpu_worker.run_worker() == 1

    [line] = uploaded["out/output.jsonl"].splitlines()
    assert json.loads(line)["embedding"] == [1.0, 1.0, 1.0]
    assert s3_client.download_extra_args == {"ExpectedBucketOwner": "123456789012"}
    assert s3_client.upload_extra_args == {"ExpectedBucketOwner": "123456789012"}
    assert not list((tmp_path / "work").glob("*.jsonl"))


def test_run_worker_rejects_failed_embedding(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    input_file = tmp_path / "input.jsonl"
    input_file.write_text(json.dumps({"id": "1", "text": "hello"}) + "\n")
    set_worker_env(monkeypatch, tmp_path)
    monkeypatch.setenv("OMLX_API_KEY", "secret")
    monkeypatch.setattr(ecs_gpu_worker.boto3, "client", lambda _name: FakeS3Client(input_file, {}))
    monkeypatch.setattr(ecs_gpu_worker, "embed_texts_omlx", lambda *_args: [None])

    with pytest.raises(ecs_gpu_worker.WorkerError, match="Embedding generation failed"):
        ecs_gpu_worker.run_worker()


def test_embed_texts_omlx_batches_requests(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_client = FakeHttpClient()
    monkeypatch.setattr(ecs_gpu_worker.httpx, "Client", lambda *args, **kwargs: fake_client)

    embeddings = ecs_gpu_worker.embed_texts_omlx(["a", "b", "c"], "http://omlx", "secret", "model", batch_size=2)

    assert [embedding.tolist() for embedding in embeddings if embedding is not None] == [[0.0], [1.0], [0.0]]
    assert [post["path"] for post in fake_client.posts] == ["/embeddings", "/embeddings"]
