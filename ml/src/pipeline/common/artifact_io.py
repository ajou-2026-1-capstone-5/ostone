from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any
from urllib.parse import urlparse

import boto3

from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineConfigurationError


@dataclass(frozen=True)
class S3Uri:
    bucket: str
    key: str

    @classmethod
    def parse(cls, value: str) -> "S3Uri":
        parsed = urlparse(value)
        if parsed.scheme != "s3" or not parsed.netloc or not parsed.path.strip("/"):
            raise PipelineConfigurationError(f"Invalid S3 URI: {value}")
        return cls(bucket=parsed.netloc, key=parsed.path.lstrip("/"))

    def __str__(self) -> str:
        return f"s3://{self.bucket}/{self.key}"


def is_s3_uri(value: str | None) -> bool:
    return isinstance(value, str) and value.startswith("s3://")


def stage_s3_prefix(stage_context: StageContext, runtime_config: PipelineRuntimeConfig) -> str:
    safe_run_id = stage_context.run_id.replace("/", "__")
    parts = [
        runtime_config.artifact_prefix,
        stage_context.dag_id,
        safe_run_id,
        stage_context.stage_name,
    ]
    return "/".join(part.strip("/") for part in parts if part)


def stage_manifest_s3_uri(stage_context: StageContext, runtime_config: PipelineRuntimeConfig) -> str:
    if not runtime_config.artifact_bucket:
        raise PipelineConfigurationError("ML_ARTIFACT_BUCKET is required to build an S3 artifact URI.")
    return f"s3://{runtime_config.artifact_bucket}/{stage_s3_prefix(stage_context, runtime_config)}/manifest.json"


def manifest_s3_uri_from_local_manifest(manifest_path: Path, *, allowed_root: Path | None = None) -> str:
    manifest = read_json_file(manifest_path, allowed_root=allowed_root)
    bucket = _required_manifest_str(manifest, "artifact_bucket", manifest_path)
    prefix = _optional_manifest_str(manifest, "artifact_prefix") or ""
    stage_context = StageContext(
        dag_id=_required_manifest_str(manifest, "dag_id", manifest_path),
        run_id=_required_manifest_str(manifest, "run_id", manifest_path),
        stage_name=_required_manifest_str(manifest, "stage_name", manifest_path),
        workspace_id=_optional_manifest_str(manifest, "workspace_id"),
        dataset_id=_optional_manifest_str(manifest, "dataset_id"),
        pipeline_job_id=_optional_manifest_str(manifest, "pipeline_job_id"),
    )
    runtime_config = PipelineRuntimeConfig(
        artifact_root=Path(_required_manifest_str(manifest, "artifact_root", manifest_path)),
        backend_base_url=os.getenv("PIPELINE_BACKEND_BASE_URL", "http://localhost"),
        callback_enabled=False,
        artifact_store="s3",
        artifact_bucket=bucket,
        artifact_prefix=prefix,
    )
    return stage_manifest_s3_uri(stage_context, runtime_config)


def materialize_manifest_uri(
    manifest_uri: str,
    target_root: Path,
    runtime_config: PipelineRuntimeConfig | None = None,
) -> Path:
    if not is_s3_uri(manifest_uri):
        return Path(manifest_uri)
    if runtime_config is None:
        runtime_config = PipelineRuntimeConfig.from_env()
    s3_uri = S3Uri.parse(manifest_uri)
    if not s3_uri.key.endswith("/manifest.json"):
        raise PipelineConfigurationError("S3 upstream manifest URI must end with /manifest.json.")
    run_prefix = _run_prefix_from_manifest_key(s3_uri.key, runtime_config)
    download_s3_prefix(
        s3_uri.bucket,
        run_prefix,
        target_root,
        strip_prefix=runtime_config.artifact_prefix,
    )
    return target_root / _relative_key_path(_strip_prefix(s3_uri.key, runtime_config.artifact_prefix))


def download_s3_prefix(bucket: str, prefix: str, target_dir: Path, *, strip_prefix: str = "") -> None:
    target_dir.mkdir(parents=True, exist_ok=True)
    s3 = boto3.client("s3")
    expected_owner = _expected_bucket_owner()
    list_kwargs: dict[str, Any] = {"Bucket": bucket, "Prefix": f"{prefix.rstrip('/')}/"}
    if expected_owner:
        list_kwargs["ExpectedBucketOwner"] = expected_owner
    while True:
        response = s3.list_objects_v2(**list_kwargs)
        for item in response.get("Contents", []):
            key = item.get("Key")
            if not isinstance(key, str) or key.endswith("/"):
                continue
            local_path = target_dir / _relative_key_path(_strip_prefix(key, strip_prefix))
            local_path.parent.mkdir(parents=True, exist_ok=True)
            get_kwargs: dict[str, Any] = {"Bucket": bucket, "Key": key}
            if expected_owner:
                get_kwargs["ExpectedBucketOwner"] = expected_owner
            response = s3.get_object(**get_kwargs)
            local_path.write_bytes(response["Body"].read())
        if not response.get("IsTruncated"):
            break
        token = response.get("NextContinuationToken")
        if not isinstance(token, str) or not token:
            break
        list_kwargs["ContinuationToken"] = token


def write_json_uri(uri: str, payload: dict[str, Any]) -> None:
    if is_s3_uri(uri):
        s3_uri = S3Uri.parse(uri)
        extra_args = {"ExpectedBucketOwner": _expected_bucket_owner()} if _expected_bucket_owner() else None
        body = json.dumps(payload, indent=2, ensure_ascii=False).encode("utf-8")
        kwargs: dict[str, Any] = {
            "Bucket": s3_uri.bucket,
            "Key": s3_uri.key,
            "Body": body,
            "ContentType": "application/json",
        }
        if extra_args:
            kwargs["ExpectedBucketOwner"] = extra_args["ExpectedBucketOwner"]
        boto3.client("s3").put_object(**kwargs)
        return
    path = Path(uri)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def read_json_uri(uri: str, *, allowed_root: Path | None = None) -> dict[str, Any]:
    if is_s3_uri(uri):
        s3_uri = S3Uri.parse(uri)
        kwargs: dict[str, Any] = {"Bucket": s3_uri.bucket, "Key": s3_uri.key}
        expected_owner = _expected_bucket_owner()
        if expected_owner:
            kwargs["ExpectedBucketOwner"] = expected_owner
        response = boto3.client("s3").get_object(**kwargs)
        payload = json.loads(response["Body"].read().decode("utf-8"))
    else:
        payload = read_json_file(Path(uri), allowed_root=allowed_root)
    if not isinstance(payload, dict):
        raise PipelineConfigurationError(f"JSON URI must contain an object: {uri}")
    return payload


def download_s3_uri(uri: str, target_path: Path) -> Path:
    s3_uri = S3Uri.parse(uri)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    kwargs: dict[str, Any] = {"Bucket": s3_uri.bucket, "Key": s3_uri.key}
    expected_owner = _expected_bucket_owner()
    if expected_owner:
        kwargs["ExpectedBucketOwner"] = expected_owner
    response = boto3.client("s3").get_object(**kwargs)
    target_path.write_bytes(response["Body"].read())
    return target_path


def read_json_file(path: Path, *, allowed_root: Path | None = None) -> dict[str, Any]:
    safe_path = _safe_local_file_path(path, allowed_root=allowed_root)
    payload = json.loads(safe_path.read_text(encoding="utf-8"))  # NOSONAR: validated artifact path.
    if not isinstance(payload, dict):
        raise PipelineConfigurationError(f"JSON file must contain an object: {safe_path}")
    return payload


def _safe_local_file_path(path: Path, *, allowed_root: Path | None = None) -> Path:
    resolved = path.expanduser().resolve()
    root = (allowed_root or resolved.parent).expanduser().resolve()
    try:
        resolved.relative_to(root)
    except ValueError as exc:
        raise PipelineConfigurationError(f"JSON file must be under the allowed artifact root: {root}") from exc
    if resolved.name in {"", ".", ".."}:
        raise PipelineConfigurationError(f"Unsafe JSON file path: {path}")
    return resolved


def _run_prefix_from_manifest_key(key: str, runtime_config: PipelineRuntimeConfig) -> str:
    relative_key = _strip_prefix(key, runtime_config.artifact_prefix)
    parts = PurePosixPath(relative_key).parts
    if len(parts) < 4 or parts[-1] != "manifest.json":
        raise PipelineConfigurationError("S3 upstream manifest URI must include dag/run/stage/manifest.json.")
    dag_id, run_id = parts[0], parts[1]
    run_relative = f"{dag_id}/{run_id}"
    return "/".join(part for part in (runtime_config.artifact_prefix, run_relative) if part)


def _strip_prefix(key: str, strip_prefix: str) -> str:
    normalized_prefix = strip_prefix.strip("/")
    normalized_key = key.strip("/")
    if normalized_prefix and normalized_key.startswith(f"{normalized_prefix}/"):
        return normalized_key[len(normalized_prefix) + 1 :]
    return normalized_key


def _relative_key_path(key: str) -> Path:
    relative = PurePosixPath(key)
    if any(part in {"", ".", ".."} for part in relative.parts):
        raise PipelineConfigurationError(f"Unsafe S3 artifact key: {key}")
    return Path(*relative.parts)


def _required_manifest_str(manifest: dict[str, Any], key: str, path: Path) -> str:
    value = manifest.get(key)
    if isinstance(value, str) and value:
        return value
    raise PipelineConfigurationError(f"Manifest field {key!r} must be a non-empty string: {path}")


def _optional_manifest_str(manifest: dict[str, Any], key: str) -> str | None:
    value = manifest.get(key)
    return value if isinstance(value, str) and value else None


def _expected_bucket_owner() -> str | None:
    value = os.getenv("S3_EXPECTED_BUCKET_OWNER", "").strip()
    return value or None
