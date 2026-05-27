from __future__ import annotations

import numpy as np
import pytest

from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.exceptions import PipelineConfigurationError
from pipeline.common.runtime import (
    LocalEmbeddingRuntime,
    _char_ngrams,
    _hashed_text_vector,
    build_embedding_runtime,
    cosine_similarity,
)


def test_local_embedding_runtime_rejects_invalid_dimension() -> None:
    with pytest.raises(PipelineConfigurationError, match="Embedding dimension"):
        LocalEmbeddingRuntime("model", "cheap", dim=0)


def test_local_embedding_runtime_handles_empty_and_blank_texts() -> None:
    runtime = LocalEmbeddingRuntime("model", "cheap", dim=8)

    empty = runtime.embed([])
    blank = runtime.embed(["   "])

    assert empty.embeddings.shape == (0, 8)
    assert empty.success_mask == []
    assert blank.embeddings.shape == (1, 8)
    assert blank.success_mask == [False]
    assert np.allclose(blank.embeddings, np.zeros((1, 8), dtype=np.float32))


def test_local_embedding_runtime_normalizes_successful_rows() -> None:
    runtime = LocalEmbeddingRuntime("model", "cheap", dim=16)

    result = runtime.embed(["배송 일정 확인"])

    assert result.success_mask == [True]
    assert result.model_name == "model"
    assert result.runtime_profile == "cheap"
    assert np.isclose(np.linalg.norm(result.embeddings[0]), 1.0)


def test_build_embedding_runtime_uses_runtime_config(tmp_path) -> None:
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


def test_hashed_text_vector_falls_back_when_no_ngrams(monkeypatch) -> None:
    monkeypatch.setattr("pipeline.common.runtime._char_ngrams", lambda _text: ())

    vector = _hashed_text_vector("x", dim=8)

    assert vector.shape == (8,)
    assert np.count_nonzero(vector) == 1


def test_char_ngrams_compacts_short_and_long_text() -> None:
    assert _char_ngrams(" A   B ") == ("a b",)
    assert "배송" in _char_ngrams("배송 문의")


def test_cosine_similarity_handles_zero_vectors_and_normal_vectors() -> None:
    assert cosine_similarity(np.zeros((3,), dtype=np.float32), np.ones((3,), dtype=np.float32)) == 0.0
    assert cosine_similarity(np.array([1.0, 0.0]), np.array([1.0, 0.0])) == 1.0
