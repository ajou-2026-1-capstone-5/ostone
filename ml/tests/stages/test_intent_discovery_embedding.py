from __future__ import annotations

# pyright: reportMissingTypeStubs=false
from types import TracebackType

import numpy as np
import pytest

from pipeline.common.exceptions import PipelineConfigurationError
from pipeline.stages.intent_discovery.embedding import embed_texts


class FakeResponse:
    def __init__(self, status_code: int, payload: object | None = None) -> None:
        empty_payload: dict[str, object] = {}
        self.status_code: int = status_code
        self._payload: object = payload if payload is not None else empty_payload

    def json(self) -> object:
        return self._payload


class FakeClient:
    def __init__(self, responses: list[FakeResponse]) -> None:
        self.responses: list[FakeResponse] = responses
        self.requests: list[tuple[str, object]] = []

    def __enter__(self) -> FakeClient:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        return None

    def post(self, endpoint: str, json: object) -> FakeResponse:
        self.requests.append((endpoint, json))
        return self.responses.pop(0)


def _payload(vectors: list[list[float]]) -> dict[str, list[dict[str, object]]]:
    return {"data": [{"embedding": vector, "index": index} for index, vector in enumerate(vectors)]}


def _vector(value: float) -> list[float]:
    return [value] * 768


def _install_client(monkeypatch: pytest.MonkeyPatch, client: FakeClient) -> None:
    def create_client(base_url: str, headers: dict[str, str], timeout: float) -> FakeClient:
        assert base_url == "http://omlx.test/v1"
        assert headers == {"Authorization": "Bearer test-key"}
        assert timeout == 30.0
        return client

    monkeypatch.setattr("pipeline.stages.intent_discovery.embedding.httpx.Client", create_client)


def test_should_embed_texts_in_batch(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OMLX_API_KEY", "test-key")
    monkeypatch.setenv("OMLX_BASE_URL", "http://omlx.test/v1")
    client = FakeClient([FakeResponse(200, _payload([_vector(1.0), _vector(2.0), _vector(3.0)]))])
    _install_client(monkeypatch, client)

    embeddings, success_mask = embed_texts(["a", "b", "c"])
    norms = np.linalg.norm(embeddings, axis=1)  # pyright: ignore[reportAny]

    assert embeddings.shape == (3, 768)
    assert embeddings.dtype == np.float32
    assert success_mask == [True, True, True]
    assert np.allclose(norms, np.ones(3, dtype=np.float32))  # pyright: ignore[reportAny]
    assert client.requests == [
        ("/embeddings", {"model": "jina-embeddings-v5-text-small-mlx", "input": ["a", "b", "c"]})
    ]


def test_should_retry_429_then_succeed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OMLX_API_KEY", "test-key")
    monkeypatch.setenv("OMLX_BASE_URL", "http://omlx.test/v1")
    delays: list[float] = []
    client = FakeClient([FakeResponse(429), FakeResponse(429), FakeResponse(200, _payload([_vector(1.0)]))])
    _install_client(monkeypatch, client)
    monkeypatch.setattr("pipeline.stages.intent_discovery.embedding.time.sleep", delays.append)

    embeddings, success_mask = embed_texts(["retry"], batch_size=1, base_delay=0.5)

    assert embeddings.shape == (1, 768)
    assert success_mask == [True]
    assert delays == [0.5, 1.0]
    assert len(client.requests) == 3


def test_should_return_zero_vectors_when_retry_exhausted(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OMLX_API_KEY", "test-key")
    monkeypatch.setenv("OMLX_BASE_URL", "http://omlx.test/v1")
    client = FakeClient([FakeResponse(500), FakeResponse(500), FakeResponse(500)])
    _install_client(monkeypatch, client)

    embeddings, success_mask = embed_texts(["a", "b"], batch_size=2, base_delay=0.0)

    assert embeddings.shape == (2, 768)
    assert success_mask == [False, False]
    assert np.array_equal(embeddings, np.zeros((2, 768), dtype=np.float32))
    assert len(client.requests) == 3


def test_should_raise_when_api_key_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OMLX_API_KEY", raising=False)

    with pytest.raises(PipelineConfigurationError):
        _ = embed_texts(["missing key"])
