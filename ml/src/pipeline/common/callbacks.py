from __future__ import annotations

import json
import re
import socket
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

CALLBACK_TYPES = {"domain-pack-drafts", "intent-drafts", "workflow-drafts"}
WEBHOOK_SECRET_HEADER = "X-Airflow-Webhook-Secret"
MAX_ARTIFACT_BODY_CHARS = 64 * 1024
SENSITIVE_HEADER_NAMES = {"authorization", "cookie", "set-cookie", WEBHOOK_SECRET_HEADER.lower()}
SENSITIVE_KEY_PARTS = ("secret", "token", "password", "authorization", "cookie", "email", "phone", "ssn")


@dataclass(frozen=True)
class CallbackResponse:
    callback_type: str
    external_event_id: str | None
    endpoint: str
    http_status: int
    response_status: str | None
    response_body: str | None
    response_body_truncated: bool
    parsed_response_body: object | None

    def to_result_entry(self) -> dict[str, object]:
        return {
            "type": self.callback_type,
            "externalEventId": self.external_event_id,
            "endpoint": self.endpoint,
            "httpStatus": self.http_status,
            "responseStatus": self.response_status,
            "responseBody": self.response_body,
            "responseBodyTruncated": self.response_body_truncated,
            "parsedResponseBody": self.parsed_response_body,
        }


class PipelineCallbackError(RuntimeError):
    def __init__(
        self,
        *,
        message: str,
        callback_type: str,
        external_event_id: str | None,
        endpoint: str,
        http_status: int | None = None,
        response_body: str | None = None,
        response_body_truncated: bool = False,
        parsed_response_body: object | None = None,
    ) -> None:
        super().__init__(message)
        self.callback_type = callback_type
        self.external_event_id = external_event_id
        self.endpoint = endpoint
        self.http_status = http_status
        self.response_body = response_body
        self.response_body_truncated = response_body_truncated
        self.parsed_response_body = parsed_response_body

    def to_error_object(self) -> dict[str, object]:
        return {
            "type": type(self).__name__,
            "message": str(self),
            "callbackType": self.callback_type,
            "externalEventId": self.external_event_id,
            "httpStatus": self.http_status,
            "responseBody": self.response_body,
            "responseBodyTruncated": self.response_body_truncated,
            "parsedResponseBody": self.parsed_response_body,
        }


def build_callback_endpoint(backend_base_url: str, job_id: str, callback_type: str) -> str:
    _require_callback_type(callback_type)
    return f"{backend_base_url.rstrip('/')}/api/v1/pipeline-jobs/{job_id}/callbacks/{callback_type}"


def post_callback(
    backend_base_url: str,
    job_id: str,
    callback_type: str,
    payload: dict[str, object],
    webhook_secret: str,
    timeout_seconds: float,
) -> CallbackResponse:
    _require_callback_type(callback_type)
    endpoint = build_callback_endpoint(backend_base_url, job_id, callback_type)
    external_event_id = _optional_str(payload.get("externalEventId"))
    headers = {
        "Content-Type": "application/json",
        WEBHOOK_SECRET_HEADER: webhook_secret,
    }
    request = Request(
        endpoint,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            raw_body = response.read()
            http_status = response.status
    except HTTPError as exc:
        response_body, response_body_truncated, parsed_response_body = parse_response_body(exc.read())
        raise PipelineCallbackError(
            message=f"Spring callback failed: httpStatus={exc.code}",
            callback_type=callback_type,
            external_event_id=external_event_id,
            endpoint=endpoint,
            http_status=exc.code,
            response_body=response_body,
            response_body_truncated=response_body_truncated,
            parsed_response_body=parsed_response_body,
        ) from exc
    except (TimeoutError, socket.timeout) as exc:
        raise PipelineCallbackError(
            message="Spring callback timed out.",
            callback_type=callback_type,
            external_event_id=external_event_id,
            endpoint=endpoint,
        ) from exc
    except URLError as exc:
        raise PipelineCallbackError(
            message=f"Spring callback request failed: {exc.reason}",
            callback_type=callback_type,
            external_event_id=external_event_id,
            endpoint=endpoint,
        ) from exc

    response_body, response_body_truncated, parsed_response_body = parse_response_body(raw_body)
    response_status = _response_status(parsed_response_body)
    if http_status < 200 or http_status >= 300:
        raise PipelineCallbackError(
            message=f"Spring callback failed: httpStatus={http_status}",
            callback_type=callback_type,
            external_event_id=external_event_id,
            endpoint=endpoint,
            http_status=http_status,
            response_body=response_body,
            response_body_truncated=response_body_truncated,
            parsed_response_body=parsed_response_body,
        )

    return CallbackResponse(
        callback_type=callback_type,
        external_event_id=external_event_id,
        endpoint=endpoint,
        http_status=http_status,
        response_status=response_status,
        response_body=response_body,
        response_body_truncated=response_body_truncated,
        parsed_response_body=parsed_response_body,
    )


def parse_response_body(raw_body: bytes | str | None) -> tuple[str | None, bool, object | None]:
    if raw_body is None:
        return None, False, None
    raw_text = raw_body.decode("utf-8", errors="replace") if isinstance(raw_body, bytes) else raw_body
    if raw_text == "":
        return None, False, None

    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError:
        redacted_text = redact_text(raw_text)
        truncated_text, truncated = truncate_text(redacted_text, MAX_ARTIFACT_BODY_CHARS)
        return truncated_text, truncated, None

    redacted_parsed = redact_json(parsed)
    redacted_text = json.dumps(redacted_parsed, ensure_ascii=False, separators=(",", ":"))
    truncated_text, truncated = truncate_text(redacted_text, MAX_ARTIFACT_BODY_CHARS)
    return truncated_text, truncated, redacted_parsed


def redact_headers(headers: dict[str, object]) -> dict[str, object]:
    redacted: dict[str, object] = {}
    for key, value in headers.items():
        if key.lower() in SENSITIVE_HEADER_NAMES:
            redacted[key] = "***"
        else:
            redacted[key] = value
    return redacted


def redact_json(value: object) -> object:
    if isinstance(value, dict):
        return {str(key): "***" if _is_sensitive_key(str(key)) else redact_json(child) for key, child in value.items()}
    if isinstance(value, list):
        return [redact_json(child) for child in value]
    return value


def redact_text(value: str) -> str:
    redacted = value
    for key_part in SENSITIVE_KEY_PARTS:
        pattern = re.compile(rf'("[^"]*{re.escape(key_part)}[^"]*"\s*:\s*)"([^"]*)"', re.IGNORECASE)
        redacted = pattern.sub(r'\1"***"', redacted)
    return redacted


def truncate_text(value: str, max_chars: int) -> tuple[str, bool]:
    if len(value) <= max_chars:
        return value, False
    return value[:max_chars], True


def _require_callback_type(callback_type: str) -> None:
    if callback_type not in CALLBACK_TYPES:
        allowed = ", ".join(sorted(CALLBACK_TYPES))
        raise ValueError(f"Unsupported callback_type: {callback_type}. allowed={allowed}")


def _response_status(parsed_response_body: object | None) -> str | None:
    if isinstance(parsed_response_body, dict):
        status = parsed_response_body.get("status")
        if isinstance(status, str):
            return status
    return None


def _optional_str(value: Any) -> str | None:
    return value if isinstance(value, str) else None


def _is_sensitive_key(key: str) -> bool:
    lowered = key.lower()
    return any(part in lowered for part in SENSITIVE_KEY_PARTS)
