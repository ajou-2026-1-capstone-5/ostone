from __future__ import annotations

import sys
import types
import urllib.error
from collections.abc import Sequence
from typing import Any

import numpy as np
import pytest

from pipeline.common import runtime as runtime_module
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.exceptions import PipelineConfigurationError
from pipeline.common.runtime import (
    FlagEmbeddingRuntime,
    HttpEmbeddingRuntime,
    build_embedding_runtime,
    cosine_similarity,
)


def test_build_embedding_runtime_uses_flag_embedding_runtime_config(monkeypatch, tmp_path) -> None:
    class FakeBGEM3FlagModel:
        def __init__(self, _model_name: str, use_fp16: bool = False) -> None:
            self.use_fp16 = use_fp16

        def encode(self, _texts: Sequence[str], **_kwargs: Any) -> dict[str, list[list[float]]]:
            return {"dense_vecs": [[1.0, 0.0]]}

    fake_module = types.ModuleType("FlagEmbedding")
    fake_module.BGEM3FlagModel = FakeBGEM3FlagModel  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "FlagEmbedding", fake_module)
    runtime_config = PipelineRuntimeConfig(
        artifact_root=tmp_path,
        backend_base_url="http://backend:8080",
        callback_enabled=False,
        embedding_model_name="custom-embedder",
        runtime_profile="balanced",
    )

    runtime = build_embedding_runtime(runtime_config)

    assert runtime.model_name == "custom-embedder"
    assert runtime.runtime_profile == "balanced"
    assert isinstance(runtime, FlagEmbeddingRuntime)


def test_runtime_config_rejects_removed_hash_embedding_runtime(tmp_path) -> None:
    with pytest.raises(PipelineConfigurationError, match="Hash, fake, and cheap"):
        PipelineRuntimeConfig(
            artifact_root=tmp_path,
            backend_base_url="http://backend:8080",
            callback_enabled=False,
            embedding_runtime="hash",
        )


def test_runtime_config_rejects_removed_cheap_profile(tmp_path) -> None:
    with pytest.raises(PipelineConfigurationError, match="balanced, quality"):
        PipelineRuntimeConfig(
            artifact_root=tmp_path,
            backend_base_url="http://backend:8080",
            callback_enabled=False,
            runtime_profile="cheap",
        )


def test_flag_embedding_runtime_embeds_non_blank_rows(monkeypatch) -> None:
    class FakeBGEM3FlagModel:
        def __init__(self, model_name: str, use_fp16: bool = False) -> None:
            self.model_name = model_name
            self.use_fp16 = use_fp16

        def encode(
            self,
            texts: Sequence[str],
            *,
            batch_size: int,
            max_length: int,
            return_dense: bool,
            return_sparse: bool,
            return_colbert_vecs: bool,
        ) -> dict[str, list[list[float]]]:
            assert batch_size == 4
            assert max_length == 64
            assert return_dense is True
            assert return_sparse is False
            assert return_colbert_vecs is False
            rows = [[float(index + 1), 0.0, 0.0] for index, _text in enumerate(texts)]
            return {"dense_vecs": rows}

    fake_module = types.ModuleType("FlagEmbedding")
    fake_module.BGEM3FlagModel = FakeBGEM3FlagModel  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "FlagEmbedding", fake_module)
    monkeypatch.setenv("EMBEDDING_RUNTIME_BATCH_SIZE", "4")
    monkeypatch.setenv("EMBEDDING_MAX_LENGTH", "64")

    runtime = FlagEmbeddingRuntime("BAAI/bge-m3", "balanced")
    result = runtime.embed(["요금 문의", "   ", "변경 문의"])

    assert result.model_name == "BAAI/bge-m3"
    assert result.runtime_profile == "balanced"
    assert result.success_mask == [True, False, True]
    assert result.embeddings.shape == (3, 3)
    assert np.allclose(result.embeddings[1], np.zeros((3,), dtype=np.float32))
    assert np.isclose(np.linalg.norm(result.embeddings[0]), 1.0)
    assert np.isclose(np.linalg.norm(result.embeddings[2]), 1.0)


def test_flag_embedding_runtime_reports_missing_optional_dependency(monkeypatch) -> None:
    monkeypatch.setitem(sys.modules, "FlagEmbedding", None)

    with pytest.raises(PipelineConfigurationError, match="optional local dependencies"):
        FlagEmbeddingRuntime("BAAI/bge-m3", "balanced")


def test_flag_embedding_runtime_uses_profile_default_max_length(monkeypatch) -> None:
    captured: dict[str, int] = {}

    class FakeBGEM3FlagModel:
        def __init__(self, _model_name: str, use_fp16: bool = False) -> None:
            self.use_fp16 = use_fp16

        def encode(
            self,
            texts: Sequence[str],
            *,
            batch_size: int,
            max_length: int,
            return_dense: bool,
            return_sparse: bool,
            return_colbert_vecs: bool,
        ) -> dict[str, list[list[float]]]:
            captured["max_length"] = max_length
            return {"dense_vecs": [[1.0, 0.0] for _text in texts]}

    fake_module = types.ModuleType("FlagEmbedding")
    fake_module.BGEM3FlagModel = FakeBGEM3FlagModel  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "FlagEmbedding", fake_module)
    monkeypatch.delenv("EMBEDDING_MAX_LENGTH", raising=False)

    runtime = FlagEmbeddingRuntime("BAAI/bge-m3", "balanced")
    runtime.embed(["요금 문의"])

    assert captured["max_length"] == 1024


def test_build_embedding_runtime_can_select_flag_embedding(monkeypatch, tmp_path) -> None:
    class FakeBGEM3FlagModel:
        def __init__(self, _model_name: str, use_fp16: bool = False) -> None:
            self.use_fp16 = use_fp16

        def encode(self, _texts: Sequence[str], **_kwargs: Any) -> dict[str, list[list[float]]]:
            return {"dense_vecs": [[1.0, 0.0]]}

    fake_module = types.ModuleType("FlagEmbedding")
    fake_module.BGEM3FlagModel = FakeBGEM3FlagModel  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "FlagEmbedding", fake_module)
    runtime_config = PipelineRuntimeConfig(
        artifact_root=tmp_path,
        backend_base_url="http://backend:8080",
        callback_enabled=False,
    )

    runtime = build_embedding_runtime(runtime_config)

    assert runtime.model_name == "BAAI/bge-m3"
    assert isinstance(runtime, FlagEmbeddingRuntime)


def test_build_embedding_runtime_can_select_local_http(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("EMBEDDING_RUNTIME_BASE_URL", "http://host.docker.internal:18090")
    runtime_config = PipelineRuntimeConfig(
        artifact_root=tmp_path,
        backend_base_url="http://backend:8080",
        callback_enabled=False,
        embedding_runtime="local_http",
    )

    runtime = build_embedding_runtime(runtime_config)

    assert runtime.model_name == "BAAI/bge-m3"
    assert isinstance(runtime, HttpEmbeddingRuntime)


def test_local_http_runtime_embeds_from_worker_response(monkeypatch) -> None:
    monkeypatch.setenv("EMBEDDING_RUNTIME_BASE_URL", "http://host.docker.internal:18090")

    class FakeResponse:
        def __enter__(self) -> "FakeResponse":
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def read(self) -> bytes:
            return (
                b'{"embeddings":[[3,4],[0,0]],"successMask":[true,false],'
                b'"modelName":"worker","runtimeProfile":"balanced"}'
            )

    def fake_urlopen(request: object, timeout: float) -> FakeResponse:
        assert timeout == 1800.0
        assert getattr(request, "full_url") == "http://host.docker.internal:18090/v1/embeddings"
        return FakeResponse()

    monkeypatch.setattr("pipeline.common.runtime.urllib.request.urlopen", fake_urlopen)
    runtime = HttpEmbeddingRuntime("BAAI/bge-m3", "balanced")

    result = runtime.embed(["요금 문의", ""])

    assert result.model_name == "worker"
    assert result.success_mask == [True, False]
    assert np.allclose(result.embeddings[0], np.array([0.6, 0.8], dtype=np.float32))


def test_local_http_runtime_returns_empty_embedding_result(monkeypatch) -> None:
    monkeypatch.setenv("EMBEDDING_RUNTIME_BASE_URL", "http://host.docker.internal:18090")
    monkeypatch.setenv("EMBEDDING_DIM", "3")

    runtime = HttpEmbeddingRuntime("BAAI/bge-m3", "balanced")
    result = runtime.embed([])

    assert result.success_mask == []
    assert result.embeddings.shape == (0, 3)


def test_local_http_runtime_rejects_invalid_worker_responses(monkeypatch) -> None:
    monkeypatch.setenv("EMBEDDING_RUNTIME_BASE_URL", "http://host.docker.internal:18090")

    class FakeResponse:
        def __enter__(self) -> "FakeResponse":
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def read(self) -> bytes:
            return b'{"embeddings":[[1,0]],"successMask":[true,false]}'

    monkeypatch.setattr("pipeline.common.runtime.urllib.request.urlopen", lambda *_args, **_kwargs: FakeResponse())
    runtime = HttpEmbeddingRuntime("BAAI/bge-m3", "balanced")

    with pytest.raises(PipelineConfigurationError, match="embedding count"):
        runtime.embed(["a", "b"])


def test_local_http_runtime_wraps_worker_request_errors(monkeypatch) -> None:
    monkeypatch.setenv("EMBEDDING_RUNTIME_BASE_URL", "http://host.docker.internal:18090")

    def fail_request(*_args: object, **_kwargs: object) -> object:
        raise urllib.error.URLError("offline")

    monkeypatch.setattr("pipeline.common.runtime.urllib.request.urlopen", fail_request)
    runtime = HttpEmbeddingRuntime("BAAI/bge-m3", "balanced")

    with pytest.raises(PipelineConfigurationError, match="request failed"):
        runtime.embed(["a"])


def test_local_http_runtime_requires_base_url(monkeypatch, tmp_path) -> None:
    monkeypatch.delenv("EMBEDDING_RUNTIME_BASE_URL", raising=False)
    runtime_config = PipelineRuntimeConfig(
        artifact_root=tmp_path,
        backend_base_url="http://backend:8080",
        callback_enabled=False,
        embedding_runtime="local_http",
    )

    with pytest.raises(PipelineConfigurationError, match="EMBEDDING_RUNTIME_BASE_URL"):
        build_embedding_runtime(runtime_config)


def test_local_http_runtime_rejects_url_without_host(monkeypatch) -> None:
    monkeypatch.setenv("EMBEDDING_RUNTIME_BASE_URL", "http:///missing-host")

    with pytest.raises(PipelineConfigurationError, match="http\\(s\\) URL"):
        HttpEmbeddingRuntime("BAAI/bge-m3", "balanced")


def test_runtime_env_helpers_reject_invalid_numeric_values(monkeypatch) -> None:
    monkeypatch.setenv("EMBEDDING_RUNTIME_TIMEOUT_SECONDS", "nan")
    with pytest.raises(PipelineConfigurationError, match="positive number"):
        runtime_module._positive_float_env("EMBEDDING_RUNTIME_TIMEOUT_SECONDS", 1.0)

    monkeypatch.setenv("EMBEDDING_RUNTIME_TIMEOUT_SECONDS", "bad")
    with pytest.raises(PipelineConfigurationError, match="positive number"):
        runtime_module._positive_float_env("EMBEDDING_RUNTIME_TIMEOUT_SECONDS", 1.0)

    monkeypatch.setenv("EMBEDDING_DIM", "0")
    with pytest.raises(PipelineConfigurationError, match="positive integer"):
        runtime_module._positive_int_env("EMBEDDING_DIM", 1024)


def test_embedding_device_uses_explicit_env_and_ignores_non_auto_default(monkeypatch) -> None:
    monkeypatch.setenv("EMBEDDING_DEVICE", "cpu")
    assert runtime_module._embedding_device(auto_device=False) == "cpu"

    monkeypatch.delenv("EMBEDDING_DEVICE", raising=False)
    assert runtime_module._embedding_device(auto_device=False) is None

    monkeypatch.setenv("EMBEDDING_DEVICE", "auto")
    monkeypatch.setattr("pipeline.common.runtime.platform.system", lambda: "Linux")
    assert runtime_module._embedding_device(auto_device=True) is None


def test_flag_embedding_runtime_auto_selects_mps_on_darwin(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeMps:
        @staticmethod
        def is_available() -> bool:
            return True

    class FakeTorchBackends:
        mps = FakeMps()

    class FakeTorch:
        backends = FakeTorchBackends()

    class FakeBGEM3FlagModel:
        def __init__(self, _model_name: str, **kwargs: object) -> None:
            captured.update(kwargs)

    fake_module = types.ModuleType("FlagEmbedding")
    fake_module.BGEM3FlagModel = FakeBGEM3FlagModel  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "FlagEmbedding", fake_module)
    monkeypatch.setitem(sys.modules, "torch", FakeTorch)
    monkeypatch.setattr("pipeline.common.runtime.platform.system", lambda: "Darwin")

    runtime = FlagEmbeddingRuntime("BAAI/bge-m3", "balanced", auto_device=True)

    assert runtime.device == "mps"
    assert captured["devices"] == "mps"


def test_cosine_similarity_handles_zero_vectors_and_normal_vectors() -> None:
    assert cosine_similarity(np.zeros((3,), dtype=np.float32), np.ones((3,), dtype=np.float32)) == 0.0
    assert cosine_similarity(np.array([1.0, 0.0]), np.array([1.0, 0.0])) == 1.0
