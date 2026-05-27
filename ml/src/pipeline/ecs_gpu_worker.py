"""ECS GPU batch worker — one-shot embedding generation via OMLX API."""

from __future__ import annotations

import json
import logging
import os
import sys
import time
from pathlib import Path
from uuid import uuid4

import boto3
import httpx
import numpy as np
from botocore.exceptions import BotoCoreError, ClientError

DEFAULT_EMBEDDING_DIM = 768
DEFAULT_OMLX_BASE_URL = "http://localhost:8081/v1"
logger = logging.getLogger(__name__)


class WorkerError(RuntimeError):
    """Raised when the one-shot ECS worker cannot complete its task."""


def _post_embeddings(client: httpx.Client, model: str, batch: list[str]) -> dict | None:
    retry_max = 3
    base_delay = 1.0
    for attempt in range(retry_max):
        try:
            resp = client.post("/embeddings", json={"model": model, "input": batch})
            resp.raise_for_status()
            return resp.json()
        except (httpx.HTTPError, ValueError):
            if attempt == retry_max - 1:
                logger.exception("Embedding request failed after %d attempts", retry_max)
                return None
            time.sleep(base_delay * (2**attempt))
    return None


def _parse_response(payload: dict) -> list[np.ndarray | None]:
    result: list[np.ndarray | None] = []
    for item in payload.get("data", []):
        embedding = item.get("embedding")
        result.append(None if embedding is None else np.array(embedding, dtype=np.float32))
    return result


def embed_texts_omlx(
    texts: list[str],
    base_url: str,
    api_key: str,
    model_name: str,
    batch_size: int = 32,
) -> list[np.ndarray | None]:
    """Embed texts via OMLX HTTP API. Returns list of embedding vectors."""

    results: list[np.ndarray | None] = []
    with httpx.Client(base_url=base_url, headers={"Authorization": f"Bearer {api_key}"}, timeout=60.0) as client:
        for start in range(0, len(texts), batch_size):
            batch = texts[start : start + batch_size]
            payload = _post_embeddings(client, model_name, batch)
            results.extend([None] * len(batch) if payload is None else _parse_response(payload))
    return results


def _required_env(name: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        raise WorkerError(f"{name} is required")
    return value


def _worker_tmp_path(suffix: str) -> Path:
    work_dir = Path(os.environ.get("GPU_WORKER_TMP_DIR", ".worker-tmp"))
    work_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(work_dir, 0o700)
    return work_dir / f"gpu-worker-{uuid4().hex}{suffix}"


def _read_records(path: Path) -> tuple[list[dict], list[str]]:
    records: list[dict] = []
    texts: list[str] = []
    with path.open() as f:
        for line in f:
            stripped = line.strip()
            if stripped:
                record = json.loads(stripped)
                records.append(record)
                texts.append(record.get("text", ""))
    return records, texts


def _write_records(path: Path, records: list[dict]) -> None:
    with path.open("x") as f:
        for record in records:
            f.write(json.dumps(record) + "\n")


def _generate_embeddings(texts: list[str], base_url: str, api_key: str, model_name: str) -> list[np.ndarray | None]:
    if not texts:
        return []
    logger.info("Generating embeddings for %d texts with model=%s", len(texts), model_name)
    return embed_texts_omlx(texts, base_url, api_key, model_name)


def _attach_embeddings(records: list[dict], embeddings: list[np.ndarray | None]) -> list[dict]:
    if len(embeddings) != len(records):
        raise WorkerError(f"Embedding count mismatch: embeddings={len(embeddings)}, records={len(records)}")
    failed_count = sum(1 for embedding in embeddings if embedding is None)
    if failed_count:
        raise WorkerError(f"Embedding generation failed for {failed_count}/{len(records)} records")

    results: list[dict] = []
    for record, embedding in zip(records, embeddings):
        record["embedding"] = embedding.tolist() if embedding is not None else None
        results.append(record)
    return results


def run_worker() -> int:
    input_bucket = _required_env("S3_INPUT_BUCKET")
    input_key = _required_env("S3_INPUT_KEY")
    output_bucket = _required_env("S3_OUTPUT_BUCKET")
    output_key = _required_env("S3_OUTPUT_KEY")
    api_key = _required_env("OMLX_API_KEY")
    expected_bucket_owner = _required_env("S3_EXPECTED_BUCKET_OWNER")
    omlx_base_url = os.environ.get("OMLX_BASE_URL", DEFAULT_OMLX_BASE_URL)
    model_name = os.environ.get("MODEL_NAME", "jina-embeddings-v5-text-small-mlx")

    s3 = boto3.client("s3")
    extra_args = {"ExpectedBucketOwner": expected_bucket_owner}
    input_path = _worker_tmp_path(".input.jsonl")
    output_path = _worker_tmp_path(".output.jsonl")
    try:
        try:
            s3.download_file(input_bucket, input_key, str(input_path), ExtraArgs=extra_args)
        except (BotoCoreError, ClientError, OSError) as exc:
            raise WorkerError(f"Failed to download from S3: {exc}") from exc

        records, texts = _read_records(input_path)
        embeddings = _generate_embeddings(texts, omlx_base_url, api_key, model_name)
        results = _attach_embeddings(records, embeddings)
        _write_records(output_path, results)

        try:
            s3.upload_file(str(output_path), output_bucket, output_key, ExtraArgs=extra_args)
        except (BotoCoreError, ClientError, OSError) as exc:
            raise WorkerError(f"Failed to upload to S3: {exc}") from exc

        success_count = sum(1 for r in results if r.get("embedding") is not None)
        print(f"SUCCESS: {success_count}/{len(results)} records processed")
        return success_count
    finally:
        input_path.unlink(missing_ok=True)
        output_path.unlink(missing_ok=True)


def main() -> None:
    logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))
    try:
        run_worker()
    except WorkerError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
