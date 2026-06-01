from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from pipeline.common.artifact_io import (
    S3Uri,
    download_s3_prefix,
    download_s3_uri,
    manifest_s3_uri_from_local_manifest,
    materialize_manifest_uri,
    read_json_file,
    read_json_uri,
    stage_manifest_s3_uri,
    stage_s3_prefix,
    write_json_uri,
)
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineConfigurationError


class _Body:
    def __init__(self, payload: bytes) -> None:
        self._payload = payload

    def read(self) -> bytes:
        return self._payload


class _FakeS3:
    def __init__(self) -> None:
        self.objects: dict[tuple[str, str], bytes] = {}
        self.calls: list[tuple[str, dict[str, Any]]] = []

    def list_objects_v2(self, **kwargs: Any) -> dict[str, Any]:
        self.calls.append(("list", kwargs))
        bucket = kwargs["Bucket"]
        prefix = kwargs["Prefix"]
        contents = [
            {"Key": key} for object_bucket, key in self.objects if object_bucket == bucket and key.startswith(prefix)
        ]
        return {"Contents": contents, "IsTruncated": False}

    def get_object(self, **kwargs: Any) -> dict[str, Any]:
        self.calls.append(("get", kwargs))
        return {"Body": _Body(self.objects[(kwargs["Bucket"], kwargs["Key"])])}

    def put_object(self, **kwargs: Any) -> None:
        self.calls.append(("put", kwargs))
        self.objects[(kwargs["Bucket"], kwargs["Key"])] = kwargs["Body"]


def _runtime(tmp_path: Path, *, store: str = "s3") -> PipelineRuntimeConfig:
    return PipelineRuntimeConfig(
        artifact_root=tmp_path / "artifacts",
        backend_base_url="http://backend:8080",
        callback_enabled=False,
        artifact_store=store,
        artifact_bucket="artifact-bucket",
        artifact_prefix="domain-pack",
    )


def test_s3_uri_and_stage_manifest_uri(tmp_path: Path) -> None:
    parsed = S3Uri.parse("s3://artifact-bucket/domain-pack/manifest.json")
    context = StageContext(dag_id="dag", run_id="manual/run", stage_name="representation")

    assert str(parsed) == "s3://artifact-bucket/domain-pack/manifest.json"
    assert stage_s3_prefix(context, _runtime(tmp_path)) == "domain-pack/dag/manual__run/representation"
    assert (
        stage_manifest_s3_uri(context, _runtime(tmp_path))
        == "s3://artifact-bucket/domain-pack/dag/manual__run/representation/manifest.json"
    )

    with pytest.raises(PipelineConfigurationError):
        S3Uri.parse("https://artifact-bucket/domain-pack/manifest.json")


def test_local_json_read_requires_allowed_root(tmp_path: Path) -> None:
    allowed = tmp_path / "allowed"
    outside = tmp_path / "outside.json"
    manifest = allowed / "manifest.json"
    manifest.parent.mkdir()
    manifest.write_text('{"ok": true}', encoding="utf-8")
    outside.write_text('{"ok": false}', encoding="utf-8")

    assert read_json_file(manifest, allowed_root=allowed) == {"ok": True}
    with pytest.raises(PipelineConfigurationError, match="allowed artifact root"):
        read_json_file(outside, allowed_root=allowed)


def test_manifest_s3_uri_from_local_manifest(tmp_path: Path) -> None:
    manifest = tmp_path / "artifacts" / "dag" / "run" / "stage" / "manifest.json"
    manifest.parent.mkdir(parents=True)
    manifest.write_text(
        json.dumps(
            {
                "artifact_bucket": "artifact-bucket",
                "artifact_prefix": "domain-pack",
                "artifact_root": str(tmp_path / "artifacts"),
                "dag_id": "dag",
                "run_id": "manual/run",
                "stage_name": "stage",
            }
        ),
        encoding="utf-8",
    )

    assert (
        manifest_s3_uri_from_local_manifest(manifest, allowed_root=tmp_path / "artifacts")
        == "s3://artifact-bucket/domain-pack/dag/manual__run/stage/manifest.json"
    )


def test_s3_json_roundtrip_uses_expected_bucket_owner(monkeypatch: pytest.MonkeyPatch) -> None:
    s3 = _FakeS3()
    monkeypatch.setattr("pipeline.common.artifact_io.boto3.client", lambda service: s3)
    monkeypatch.setenv("S3_EXPECTED_BUCKET_OWNER", "123456789012")

    write_json_uri("s3://artifact-bucket/path/manifest.json", {"value": 7})

    assert read_json_uri("s3://artifact-bucket/path/manifest.json") == {"value": 7}
    assert s3.calls[0][0] == "put"
    assert s3.calls[0][1]["ExpectedBucketOwner"] == "123456789012"
    assert s3.calls[1][0] == "get"
    assert s3.calls[1][1]["ExpectedBucketOwner"] == "123456789012"


def test_materialize_manifest_uri_downloads_run_prefix(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    s3 = _FakeS3()
    s3.objects[("artifact-bucket", "domain-pack/dag/run/ingestion/manifest.json")] = b'{"stage":"ingestion"}'
    s3.objects[("artifact-bucket", "domain-pack/dag/run/preprocessing/manifest.json")] = b'{"stage":"pre"}'
    monkeypatch.setattr("pipeline.common.artifact_io.boto3.client", lambda service: s3)
    monkeypatch.setenv("S3_EXPECTED_BUCKET_OWNER", "123456789012")

    local_manifest = materialize_manifest_uri(
        "s3://artifact-bucket/domain-pack/dag/run/preprocessing/manifest.json",
        tmp_path / "downloaded",
        _runtime(tmp_path),
    )

    assert local_manifest == tmp_path / "downloaded" / "dag" / "run" / "preprocessing" / "manifest.json"
    assert json.loads(local_manifest.read_text(encoding="utf-8")) == {"stage": "pre"}
    get_calls = [kwargs for name, kwargs in s3.calls if name == "get"]
    assert all(call["ExpectedBucketOwner"] == "123456789012" for call in get_calls)


def test_download_s3_prefix_rejects_unsafe_keys(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    s3 = _FakeS3()
    s3.objects[("artifact-bucket", "domain-pack/dag/run/../manifest.json")] = b"{}"
    monkeypatch.setattr("pipeline.common.artifact_io.boto3.client", lambda service: s3)

    with pytest.raises(PipelineConfigurationError, match="Unsafe S3 artifact key"):
        download_s3_prefix(
            "artifact-bucket",
            "domain-pack/dag/run",
            tmp_path / "downloaded",
            strip_prefix="domain-pack",
        )


def test_download_s3_uri_writes_file(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    s3 = _FakeS3()
    s3.objects[("artifact-bucket", "domain-pack/input.json")] = b'{"input": true}'
    monkeypatch.setattr("pipeline.common.artifact_io.boto3.client", lambda service: s3)

    target = download_s3_uri("s3://artifact-bucket/domain-pack/input.json", tmp_path / "input.json")

    assert target.read_text(encoding="utf-8") == '{"input": true}'
