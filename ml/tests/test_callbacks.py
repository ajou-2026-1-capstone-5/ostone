from __future__ import annotations

import io
import json
from email.message import Message
from typing import Any
from urllib.error import HTTPError

import pytest

from pipeline.common import callbacks
from pipeline.common.callbacks import PipelineCallbackError, parse_response_body, post_callback, redact_headers


class _FakeResponse:
    status = 201

    def __init__(self, body: bytes) -> None:
        self._body = body

    def __enter__(self) -> "_FakeResponse":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def read(self) -> bytes:
        return self._body


def test_callback_client_sends_secret_header(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, Any] = {}

    def fake_urlopen(request: Any, timeout: float) -> _FakeResponse:
        captured["headers"] = dict(request.header_items())
        captured["timeout"] = timeout
        return _FakeResponse(b'{"status":"CREATED","domainPackVersionId":101}')

    monkeypatch.setattr(callbacks, "urlopen", fake_urlopen)

    response = post_callback(
        "http://backend:8080",
        "11",
        "intent-drafts",
        {"externalEventId": "dag:run:intent-drafts", "domainPackVersionId": 101, "intents": []},
        "secret-value",
        3.5,
    )

    assert captured["headers"]["X-airflow-webhook-secret"] == "secret-value"
    assert captured["timeout"] == 3.5
    assert response.http_status == 201
    assert response.response_status == "CREATED"


def test_non_2xx_raises_callback_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_urlopen(_request: Any, timeout: float) -> _FakeResponse:
        assert timeout == 10
        headers = Message()
        raise HTTPError(
            "http://backend:8080/api/v1/pipeline-jobs/11/callbacks/intent-drafts",
            400,
            "Bad Request",
            headers,
            io.BytesIO(b'{"code":"VALIDATION_ERROR","email":"user@example.com"}'),
        )

    monkeypatch.setattr(callbacks, "urlopen", fake_urlopen)

    with pytest.raises(PipelineCallbackError) as exc_info:
        post_callback(
            "http://backend:8080",
            "11",
            "intent-drafts",
            {"externalEventId": "dag:run:intent-drafts"},
            "secret-value",
            10,
        )

    assert exc_info.value.http_status == 400
    assert exc_info.value.parsed_response_body == {"code": "VALIDATION_ERROR", "email": "***"}
    assert exc_info.value.response_body == '{"code":"VALIDATION_ERROR","email":"***"}'


def test_callback_response_body_keeps_redacted_raw_text() -> None:
    response_body, truncated, parsed = parse_response_body(
        json.dumps({"status": "CREATED", "token": "abc", "nested": {"phone": "010"}}).encode()
    )

    assert truncated is False
    assert response_body == '{"status":"CREATED","token":"***","nested":{"phone":"***"}}'
    assert parsed == {"status": "CREATED", "token": "***", "nested": {"phone": "***"}}


def test_callback_response_body_truncates_parsed_body() -> None:
    response_body, truncated, parsed = parse_response_body(
        json.dumps({"status": "CREATED", "items": ["x" * callbacks.MAX_ARTIFACT_BODY_CHARS]}).encode()
    )

    assert truncated is True
    assert isinstance(response_body, str)
    assert len(response_body) == callbacks.MAX_ARTIFACT_BODY_CHARS
    assert parsed == {"_truncated": True, "body": response_body, "status": "CREATED"}


def test_redacts_secret_and_sensitive_fields_before_logging() -> None:
    assert redact_headers(
        {
            "X-Airflow-Webhook-Secret": "secret",
            "Authorization": "Bearer token",
            "Content-Type": "application/json",
        }
    ) == {
        "X-Airflow-Webhook-Secret": "***",
        "Authorization": "***",
        "Content-Type": "application/json",
    }
