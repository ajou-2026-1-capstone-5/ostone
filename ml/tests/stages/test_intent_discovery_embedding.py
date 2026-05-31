from __future__ import annotations

import sys
import types
from collections.abc import Sequence
from typing import Any

import numpy as np
import pytest

from pipeline.common.exceptions import PipelineConfigurationError
from pipeline.stages.intent_discovery.embedding import embed_texts


def test_should_embed_texts_without_external_embedding_config(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    _install_fake_flag_embedding(monkeypatch)

    embeddings, success_mask = embed_texts(["배송 조회", "환불 요청", "배송 조회"])
    norms = np.linalg.norm(embeddings, axis=1)  # pyright: ignore[reportAny]

    assert embeddings.shape == (3, 3)
    assert embeddings.dtype == np.float32
    assert success_mask == [True, True, True]
    assert np.allclose(norms, np.ones(3, dtype=np.float32))  # pyright: ignore[reportAny]
    assert np.array_equal(embeddings[0], embeddings[2])
    assert not np.array_equal(embeddings[0], embeddings[1])


def test_should_mark_blank_text_as_failed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    _install_fake_flag_embedding(monkeypatch)

    embeddings, success_mask = embed_texts([""])

    assert embeddings.shape == (1, 1024)
    assert success_mask == [False]
    assert np.array_equal(embeddings, np.zeros((1, 1024), dtype=np.float32))


def test_should_reject_non_positive_batch_size(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")

    with pytest.raises(PipelineConfigurationError, match="batch_size"):
        _ = embed_texts(["배송"], batch_size=0)


def _install_fake_flag_embedding(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeBGEM3FlagModel:
        def __init__(self, _model_name: str, use_fp16: bool = False) -> None:
            self.use_fp16 = use_fp16

        def encode(self, texts: Sequence[str], **_kwargs: Any) -> dict[str, list[list[float]]]:
            rows: list[list[float]] = []
            for text in texts:
                if "배송" in text:
                    rows.append([1.0, 0.0, 0.0])
                elif "환불" in text:
                    rows.append([0.0, 1.0, 0.0])
                else:
                    rows.append([0.0, 0.0, 1.0])
            return {"dense_vecs": rows}

    fake_module = types.ModuleType("FlagEmbedding")
    fake_module.BGEM3FlagModel = FakeBGEM3FlagModel  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "FlagEmbedding", fake_module)
