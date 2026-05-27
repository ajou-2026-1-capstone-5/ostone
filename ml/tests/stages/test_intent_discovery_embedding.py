from __future__ import annotations

import numpy as np
import pytest

from pipeline.common.exceptions import PipelineConfigurationError
from pipeline.stages.intent_discovery.embedding import embed_texts


def test_should_embed_texts_without_external_embedding_config(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")

    embeddings, success_mask = embed_texts(["배송 조회", "환불 요청", "배송 조회"])
    norms = np.linalg.norm(embeddings, axis=1)  # pyright: ignore[reportAny]

    assert embeddings.shape == (3, 768)
    assert embeddings.dtype == np.float32
    assert success_mask == [True, True, True]
    assert np.allclose(norms, np.ones(3, dtype=np.float32))  # pyright: ignore[reportAny]
    assert np.array_equal(embeddings[0], embeddings[2])
    assert not np.array_equal(embeddings[0], embeddings[1])


def test_should_mark_blank_text_as_failed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")

    embeddings, success_mask = embed_texts([""])

    assert embeddings.shape == (1, 768)
    assert success_mask == [False]
    assert np.array_equal(embeddings, np.zeros((1, 768), dtype=np.float32))


def test_should_reject_non_positive_batch_size(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")

    with pytest.raises(PipelineConfigurationError, match="batch_size"):
        _ = embed_texts(["배송"], batch_size=0)
