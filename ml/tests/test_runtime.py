from __future__ import annotations

import sys
import types
from collections.abc import Sequence
from typing import Any

import numpy as np
import pytest

from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.exceptions import PipelineConfigurationError
from pipeline.common.runtime import (
    FlagEmbeddingRuntime,
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


def test_cosine_similarity_handles_zero_vectors_and_normal_vectors() -> None:
    assert cosine_similarity(np.zeros((3,), dtype=np.float32), np.ones((3,), dtype=np.float32)) == 0.0
    assert cosine_similarity(np.array([1.0, 0.0]), np.array([1.0, 0.0])) == 1.0
