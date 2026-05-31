from __future__ import annotations

import json
from http import HTTPStatus
from io import BytesIO

import numpy as np
import pytest

from pipeline.local_embedder_server import LocalEmbedderHandler, _runtime_from_env, main


def _handler() -> LocalEmbedderHandler:
    return object.__new__(LocalEmbedderHandler)


def test_health_reports_unloaded_model(monkeypatch) -> None:
    handler = _handler()
    handler.path = "/health"
    responses: list[tuple[dict[str, object], HTTPStatus]] = []
    monkeypatch.setattr("pipeline.local_embedder_server._runtime", None)
    monkeypatch.setattr(
        handler, "_write_json", lambda payload, status=HTTPStatus.OK: responses.append((payload, status))
    )

    handler.do_GET()

    payload, status = responses[0]
    assert status == HTTPStatus.OK
    assert payload["status"] == "UP"
    assert payload["modelLoaded"] is False


def test_get_unknown_path_returns_not_found(monkeypatch) -> None:
    handler = _handler()
    handler.path = "/missing"
    responses: list[tuple[dict[str, object], HTTPStatus]] = []
    monkeypatch.setattr(
        handler, "_write_json", lambda payload, status=HTTPStatus.OK: responses.append((payload, status))
    )

    handler.do_GET()

    assert responses == [({"error": "not_found"}, HTTPStatus.NOT_FOUND)]


def test_post_unknown_path_returns_not_found(monkeypatch) -> None:
    handler = _handler()
    handler.path = "/missing"
    responses: list[tuple[dict[str, object], HTTPStatus]] = []
    monkeypatch.setattr(
        handler,
        "_write_json",
        lambda payload, status=HTTPStatus.OK: responses.append((payload, status)),
    )

    handler.do_POST()

    assert responses == [({"error": "not_found"}, HTTPStatus.NOT_FOUND)]


def test_embedding_request_returns_worker_payload(monkeypatch) -> None:
    class FakeRuntime:
        device = "mps"

        def embed(self, texts: list[str]) -> object:
            assert texts == ["요금 문의"]
            return type(
                "EmbeddingResult",
                (),
                {
                    "embeddings": np.array([[1.0, 0.0]], dtype=np.float32),
                    "success_mask": [True],
                    "model_name": "fake-model",
                    "runtime_profile": "balanced",
                },
            )()

    handler = _handler()
    handler.path = "/v1/embeddings"
    responses: list[tuple[dict[str, object], HTTPStatus]] = []
    monkeypatch.setattr(handler, "_read_json", lambda: {"texts": ["요금 문의"]})
    monkeypatch.setattr(
        handler, "_write_json", lambda payload, status=HTTPStatus.OK: responses.append((payload, status))
    )
    monkeypatch.setattr("pipeline.local_embedder_server._runtime_from_env", lambda: FakeRuntime())

    handler.do_POST()

    payload, status = responses[0]
    assert status == HTTPStatus.OK
    assert payload["modelName"] == "fake-model"
    assert payload["device"] == "mps"
    assert payload["embeddings"] == [[1.0, 0.0]]


def test_embedding_request_returns_internal_error_for_unexpected_failures(monkeypatch) -> None:
    handler = _handler()
    handler.path = "/v1/embeddings"
    responses: list[tuple[dict[str, object], HTTPStatus]] = []
    monkeypatch.setattr(handler, "_read_json", lambda: {"texts": ["요금 문의"]})
    monkeypatch.setattr(
        handler,
        "_write_json",
        lambda payload, status=HTTPStatus.OK: responses.append((payload, status)),
    )
    monkeypatch.setattr(
        "pipeline.local_embedder_server._runtime_from_env", lambda: (_ for _ in ()).throw(RuntimeError("boom"))
    )

    handler.do_POST()

    assert responses == [({"error": "boom"}, HTTPStatus.INTERNAL_SERVER_ERROR)]


@pytest.mark.parametrize("payload", [{}, {"texts": ["ok", 1]}])
def test_embedding_request_rejects_invalid_payload(monkeypatch, payload: dict[str, object]) -> None:
    handler = _handler()
    handler.path = "/v1/embeddings"
    responses: list[tuple[dict[str, object], HTTPStatus]] = []
    monkeypatch.setattr(handler, "_read_json", lambda: payload)
    monkeypatch.setattr(
        handler, "_write_json", lambda response, status=HTTPStatus.OK: responses.append((response, status))
    )

    handler.do_POST()

    assert responses[0][1] == HTTPStatus.BAD_REQUEST


def test_read_json_requires_valid_content_length() -> None:
    handler = _handler()
    handler.headers = {}

    with pytest.raises(ValueError, match="Content-Length"):
        handler._read_json()

    handler.headers = {"Content-Length": "not-int"}
    with pytest.raises(ValueError, match="integer"):
        handler._read_json()

    handler.headers = {"Content-Length": "0"}
    with pytest.raises(ValueError, match="between 1"):
        handler._read_json()

    handler.headers = {"Content-Length": "11"}
    handler.rfile = BytesIO(b'{"ok":true}')
    assert handler._read_json() == {"ok": True}


def test_read_json_rejects_body_larger_than_limit(monkeypatch) -> None:
    handler = _handler()
    handler.headers = {"Content-Length": "12"}
    handler.rfile = BytesIO(b'{"ok":true}')
    monkeypatch.setenv("LOCAL_EMBEDDER_MAX_BODY_BYTES", "8")

    with pytest.raises(ValueError, match="between 1 and 8"):
        handler._read_json()


def test_write_json_sets_headers_and_body() -> None:
    handler = _handler()
    calls: list[tuple[str, object]] = []
    handler.wfile = BytesIO()
    handler.send_response = lambda status: calls.append(("status", status))
    handler.send_header = lambda name, value: calls.append((name, value))
    handler.end_headers = lambda: calls.append(("end", None))

    handler._write_json({"상태": "정상"}, status=HTTPStatus.CREATED)

    assert calls[0] == ("status", HTTPStatus.CREATED)
    assert ("Content-Type", "application/json; charset=utf-8") in calls
    assert json.loads(handler.wfile.getvalue().decode("utf-8")) == {"상태": "정상"}


def test_log_message_delegates_to_logger(monkeypatch) -> None:
    handler = _handler()
    messages: list[tuple[str, str, str]] = []
    handler.address_string = lambda: "127.0.0.1"
    monkeypatch.setattr(
        "pipeline.local_embedder_server.logger.info",
        lambda template, host, message: messages.append((template, host, message)),
    )

    handler.log_message("GET %s", "/health")

    assert messages == [("%s - %s", "127.0.0.1", "GET /health")]


def test_runtime_from_env_reuses_cached_runtime(monkeypatch) -> None:
    class FakeRuntime:
        device = "mps"

        def __init__(self, model_name: str, runtime_profile: str, *, auto_device: bool) -> None:
            self.model_name = model_name
            self.runtime_profile = runtime_profile
            self.auto_device = auto_device

    monkeypatch.setenv("EMBEDDING_MODEL_NAME", "model-a")
    monkeypatch.setenv("ML_RUNTIME_PROFILE", "quality")
    monkeypatch.setattr("pipeline.local_embedder_server._runtime", None)
    monkeypatch.setattr("pipeline.local_embedder_server.FlagEmbeddingRuntime", FakeRuntime)

    first = _runtime_from_env()
    second = _runtime_from_env()

    assert first is second
    assert first.model_name == "model-a"
    assert first.runtime_profile == "quality"
    assert first.auto_device is True


def test_main_starts_threading_server(monkeypatch) -> None:
    class FakeServer:
        def __init__(self, address: tuple[str, int], handler_class: type[LocalEmbedderHandler]) -> None:
            self.address = address
            self.handler_class = handler_class
            calls.append(("init", address, handler_class))

        def serve_forever(self) -> None:
            calls.append(("serve", self.address, self.handler_class))

    calls: list[tuple[str, tuple[str, int], type[LocalEmbedderHandler]]] = []
    monkeypatch.setenv("LOCAL_EMBEDDER_HOST", "0.0.0.0")
    monkeypatch.setenv("LOCAL_EMBEDDER_PORT", "18181")
    monkeypatch.setattr("pipeline.local_embedder_server.ThreadingHTTPServer", FakeServer)

    main()

    assert calls == [
        ("init", ("0.0.0.0", 18181), LocalEmbedderHandler),
        ("serve", ("0.0.0.0", 18181), LocalEmbedderHandler),
    ]
