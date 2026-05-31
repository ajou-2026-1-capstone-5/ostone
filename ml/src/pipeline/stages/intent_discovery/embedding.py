from __future__ import annotations

from collections.abc import Sequence

import numpy as np

from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.exceptions import PipelineConfigurationError
from pipeline.common.runtime import DEFAULT_EMBEDDING_DIM, build_embedding_runtime
from pipeline.stages.intent_discovery.types import DEFAULT_EMBEDDING_BATCH_SIZE


def embed_texts(
    texts: Sequence[str],
    batch_size: int = DEFAULT_EMBEDDING_BATCH_SIZE,
    retry_max: int = 3,
    base_delay: float = 1.0,
    runtime_config: PipelineRuntimeConfig | None = None,
) -> tuple[np.ndarray, list[bool]]:
    """Embed texts through the configured local/runtime-backed embedder.

    Production should swap the runtime implementation behind this contract,
    not call an external embedding endpoint from intent discovery.
    """

    del retry_max, base_delay
    if batch_size <= 0:
        raise PipelineConfigurationError("Embedding batch_size must be greater than 0.")
    if not texts:
        return np.zeros((0, DEFAULT_EMBEDDING_DIM), dtype=np.float32), []

    runtime = build_embedding_runtime(runtime_config)
    rows: list[np.ndarray] = []
    success_mask: list[bool] = []
    for start in range(0, len(texts), batch_size):
        batch = texts[start : start + batch_size]
        result = runtime.embed(batch)
        rows.append(result.embeddings)
        success_mask.extend(result.success_mask)
    return np.vstack(rows).astype(np.float32, copy=False), success_mask


__all__ = ["embed_texts"]
