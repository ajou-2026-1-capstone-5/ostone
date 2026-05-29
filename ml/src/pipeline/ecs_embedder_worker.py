"""ECS one-shot embedder task backed by the local FlagEmbedding runtime."""

from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path
from uuid import uuid4

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from pipeline.common.config import (
    DEFAULT_EMBEDDING_MODEL_NAME,
    DEFAULT_RUNTIME_PROFILE,
    PipelineRuntimeConfig,
)
from pipeline.common.runtime import EmbeddingRuntime, build_embedding_runtime

logger = logging.getLogger(__name__)


class WorkerError(RuntimeError):
    """Raised when the ECS embedder task cannot complete its batch."""


def _required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise WorkerError(f"{name} is required")
    return value


def _worker_tmp_path(suffix: str) -> Path:
    work_dir = Path(os.environ.get("GPU_WORKER_TMP_DIR", ".worker-tmp"))
    work_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(work_dir, 0o700)
    return work_dir / f"ml-embedder-{uuid4().hex}{suffix}"


def _read_records(path: Path) -> tuple[list[dict[str, object]], list[str]]:
    records: list[dict[str, object]] = []
    texts: list[str] = []
    with path.open(encoding="utf-8") as input_file:
        for line in input_file:
            stripped = line.strip()
            if not stripped:
                continue
            record = json.loads(stripped)
            if not isinstance(record, dict):
                raise WorkerError("Input JSONL records must be objects.")
            text = record.get("text", "")
            records.append(record)
            texts.append(text if isinstance(text, str) else "")
    return records, texts


def _write_records(path: Path, records: list[dict[str, object]]) -> None:
    with path.open("x", encoding="utf-8") as output_file:
        for record in records:
            output_file.write(json.dumps(record, ensure_ascii=False) + "\n")


def _embedding_runtime_from_env() -> EmbeddingRuntime:
    runtime_config = PipelineRuntimeConfig(
        artifact_root=Path(os.environ.get("PIPELINE_ARTIFACT_ROOT", "/tmp/artifacts")),
        backend_base_url=os.environ.get("PIPELINE_BACKEND_BASE_URL", "http://localhost"),
        callback_enabled=False,
        embedding_model_name=os.environ.get("EMBEDDING_MODEL_NAME", DEFAULT_EMBEDDING_MODEL_NAME),
        runtime_profile=os.environ.get("ML_RUNTIME_PROFILE", DEFAULT_RUNTIME_PROFILE),
    )
    return build_embedding_runtime(runtime_config)


def _attach_embeddings(
    records: list[dict[str, object]],
    texts: list[str],
    runtime: EmbeddingRuntime,
) -> list[dict[str, object]]:
    if not records:
        return []
    result = runtime.embed(texts)
    if len(result.success_mask) != len(records) or result.embeddings.shape[0] != len(records):
        raise WorkerError(
            "Embedding count mismatch: "
            f"embeddings={result.embeddings.shape[0]}, successMask={len(result.success_mask)}, records={len(records)}"
        )
    failed_count = result.success_mask.count(False)
    if failed_count:
        raise WorkerError(f"Embedding generation failed for {failed_count}/{len(records)} records")

    output: list[dict[str, object]] = []
    for index, record in enumerate(records):
        enriched = dict(record)
        enriched["embedding"] = result.embeddings[index].astype(float).tolist()
        enriched["embeddingModelName"] = result.model_name
        enriched["embeddingRuntimeProfile"] = result.runtime_profile
        output.append(enriched)
    return output


def run_worker() -> int:
    input_bucket = _required_env("S3_INPUT_BUCKET")
    input_key = _required_env("S3_INPUT_KEY")
    output_bucket = _required_env("S3_OUTPUT_BUCKET")
    output_key = _required_env("S3_OUTPUT_KEY")
    expected_bucket_owner = _required_env("S3_EXPECTED_BUCKET_OWNER")

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
        logger.info("Generating embeddings for %d records", len(records))
        results = _attach_embeddings(records, texts, _embedding_runtime_from_env())
        _write_records(output_path, results)

        try:
            s3.upload_file(str(output_path), output_bucket, output_key, ExtraArgs=extra_args)
        except (BotoCoreError, ClientError, OSError) as exc:
            raise WorkerError(f"Failed to upload to S3: {exc}") from exc

        print(f"SUCCESS: {len(results)}/{len(records)} records processed")
        return len(results)
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
