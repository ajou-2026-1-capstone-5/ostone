from __future__ import annotations

import json
import logging
import os
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from pipeline.common.config import DEFAULT_EMBEDDING_MODEL_NAME, DEFAULT_RUNTIME_PROFILE
from pipeline.common.exceptions import PipelineConfigurationError
from pipeline.common.runtime import FlagEmbeddingRuntime

logger = logging.getLogger(__name__)
DEFAULT_MAX_BODY_BYTES = 2 * 1024 * 1024
_runtime: FlagEmbeddingRuntime | None = None
_runtime_lock = threading.Lock()


def _runtime_from_env() -> FlagEmbeddingRuntime:
    global _runtime
    if _runtime is None:
        with _runtime_lock:
            if _runtime is None:
                model_name = os.getenv("EMBEDDING_MODEL_NAME", DEFAULT_EMBEDDING_MODEL_NAME)
                runtime_profile = os.getenv("ML_RUNTIME_PROFILE", DEFAULT_RUNTIME_PROFILE)
                logger.info("Loading local embedding model=%s profile=%s", model_name, runtime_profile)
                _runtime = FlagEmbeddingRuntime(
                    model_name=model_name, runtime_profile=runtime_profile, auto_device=True
                )
                logger.info("Local embedding model loaded device=%s", _runtime.device or "default")
    return _runtime


class LocalEmbedderHandler(BaseHTTPRequestHandler):
    server_version = "OstoneLocalEmbedder/1.0"

    def do_GET(self) -> None:
        if self.path != "/health":
            self._write_json({"error": "not_found"}, status=HTTPStatus.NOT_FOUND)
            return
        runtime = _runtime
        self._write_json(
            {
                "status": "UP",
                "modelLoaded": runtime is not None,
                "modelName": None if runtime is None else runtime.model_name,
                "runtimeProfile": None if runtime is None else runtime.runtime_profile,
                "device": None if runtime is None else runtime.device,
            }
        )

    def do_POST(self) -> None:
        if self.path != "/v1/embeddings":
            self._write_json({"error": "not_found"}, status=HTTPStatus.NOT_FOUND)
            return
        try:
            payload = self._read_json()
            texts = payload.get("texts") if isinstance(payload, dict) else None
            if not isinstance(texts, list) or any(not isinstance(text, str) for text in texts):
                raise ValueError("texts must be a list of strings")
            runtime = _runtime_from_env()
            result = runtime.embed(texts)
            self._write_json(
                {
                    "embeddings": result.embeddings.astype(float).tolist(),
                    "successMask": result.success_mask,
                    "modelName": result.model_name,
                    "runtimeProfile": result.runtime_profile,
                    "device": runtime.device,
                }
            )
        except (ValueError, PipelineConfigurationError) as exc:
            logger.warning("Local embedding request rejected: %s", exc)
            self._write_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
        except Exception as exc:
            logger.exception("Local embedding request failed")
            self._write_json({"error": str(exc)}, status=HTTPStatus.INTERNAL_SERVER_ERROR)

    def log_message(self, format: str, *args: Any) -> None:
        logger.info("%s - %s", self.address_string(), format % args)

    def _read_json(self) -> object:
        length_header = self.headers.get("Content-Length")
        if not length_header:
            raise ValueError("Content-Length is required")
        try:
            length = int(length_header)
        except ValueError as exc:
            raise ValueError("Content-Length must be an integer") from exc
        max_body_bytes = _max_body_bytes()
        if length <= 0 or length > max_body_bytes:
            raise ValueError(f"Content-Length must be between 1 and {max_body_bytes}")
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def _write_json(self, payload: dict[str, object], status: HTTPStatus = HTTPStatus.OK) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(int(status))
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


def _max_body_bytes() -> int:
    raw = os.getenv("LOCAL_EMBEDDER_MAX_BODY_BYTES", str(DEFAULT_MAX_BODY_BYTES)).strip()
    try:
        value = int(raw)
    except ValueError:
        return DEFAULT_MAX_BODY_BYTES
    return value if value > 0 else DEFAULT_MAX_BODY_BYTES


def main() -> None:
    logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))
    host = os.environ.get("LOCAL_EMBEDDER_HOST", "127.0.0.1")
    port = int(os.environ.get("LOCAL_EMBEDDER_PORT", "18090"))
    server = ThreadingHTTPServer((host, port), LocalEmbedderHandler)
    logger.info("Local embedding worker listening on %s:%d", host, port)
    server.serve_forever()


if __name__ == "__main__":
    main()
