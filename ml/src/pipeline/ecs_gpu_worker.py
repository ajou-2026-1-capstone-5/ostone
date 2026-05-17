"""ECS GPU batch worker — one-shot embedding generation via OMLX API."""

from __future__ import annotations

import json
import os
import sys
import tempfile

import boto3
import httpx
import numpy as np

DEFAULT_EMBEDDING_DIM = 768
DEFAULT_OMLX_BASE_URL = "http://localhost:8081/v1"


def embed_texts_omlx(
    texts: list[str],
    base_url: str,
    api_key: str,
    model_name: str,
    batch_size: int = 32,
) -> list[np.ndarray | None]:
    """Embed texts via OMLX HTTP API. Returns list of embedding vectors."""

    def post_embeddings(client: httpx.Client, model: str, batch: list[str]) -> dict | None:
        retry_max = 3
        base_delay = 1.0
        for attempt in range(retry_max):
            try:
                resp = client.post("/v1/embeddings", json={"model": model, "input": batch})
                resp.raise_for_status()
                return resp.json()
            except Exception:
                if attempt < retry_max - 1:
                    import time
                    time.sleep(base_delay * (2 ** attempt))
                else:
                    return None
        return None

    def parse_response(payload: dict) -> list[np.ndarray | None]:
        data = payload.get("data", [])
        result: list[np.ndarray | None] = []
        for item in data:
            embedding = item.get("embedding")
            if embedding is None:
                result.append(None)
                continue
            result.append(np.array(embedding, dtype=np.float32))
        return result

    results: list[np.ndarray | None] = []
    with httpx.Client(base_url=base_url, headers={"Authorization": f"Bearer {api_key}"}, timeout=60.0) as client:
        for start in range(0, len(texts), batch_size):
            batch = texts[start : start + batch_size]
            payload = post_embeddings(client, model_name, batch)
            if payload is None:
                results.extend([None] * len(batch))
                continue
            results.extend(parse_response(payload))
    return results


def main() -> None:
    input_bucket = os.environ.get("S3_INPUT_BUCKET", "")
    input_key = os.environ.get("S3_INPUT_KEY", "")
    output_bucket = os.environ.get("S3_OUTPUT_BUCKET", "")
    output_key = os.environ.get("S3_OUTPUT_KEY", "")
    omlx_base_url = os.environ.get("OMLX_BASE_URL", DEFAULT_OMLX_BASE_URL)
    model_name = os.environ.get("MODEL_NAME", "jina-embeddings-v5-text-small-mlx")
    api_key = os.environ.get("OMLX_API_KEY", "")

    if not all([input_bucket, input_key, output_bucket, output_key]):
        print("ERROR: Missing required env vars", file=sys.stderr)
        sys.exit(1)

    s3 = boto3.client("s3")
    tmp_path = tempfile.mktemp(suffix=".jsonl")

    try:
        s3.download_file(input_bucket, input_key, tmp_path)
    except Exception as e:
        print(f"ERROR: Failed to download from S3: {e}", file=sys.stderr)
        sys.exit(1)

    records: list[dict] = []
    texts: list[str] = []
    with open(tmp_path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            record = json.loads(line)
            records.append(record)
            texts.append(record.get("text", ""))

    if api_key and texts:
        embeddings = embed_texts_omlx(texts, omlx_base_url, api_key, model_name)
    else:
        embeddings = [np.zeros(DEFAULT_EMBEDDING_DIM, dtype=np.float32) for _ in texts]

    results: list[dict] = []
    for record, embedding in zip(records, embeddings):
        record["embedding"] = embedding.tolist() if embedding is not None else None
        results.append(record)

    output_path = "/tmp/output.jsonl"
    with open(output_path, "w") as f:
        for r in results:
            f.write(json.dumps(r) + "\n")

    try:
        s3.upload_file(output_path, output_bucket, output_key)
    except Exception as e:
        print(f"ERROR: Failed to upload to S3: {e}", file=sys.stderr)
        sys.exit(1)

    success_count = sum(1 for r in results if r.get("embedding") is not None)
    print(f"SUCCESS: {success_count}/{len(results)} records processed")
    sys.exit(0)


if __name__ == "__main__":
    main()