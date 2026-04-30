from __future__ import annotations

# pyright: reportMissingImports=false, reportMissingTypeStubs=false, reportUnknownVariableType=false, reportUnknownMemberType=false, reportUnknownArgumentType=false
import time
from collections.abc import Sequence
from dataclasses import replace
from typing import cast

import numpy as np

from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.logging import get_stage_logger
from pipeline.stages.preprocessing.canonicalize import apply_canonicalization, normalize_speaker_role
from pipeline.stages.preprocessing.flow_signature import build_signature
from pipeline.stages.preprocessing.io import (
    read_ingestion_artifact,
    read_stage_context,
    write_preprocessed_artifact,
)
from pipeline.stages.preprocessing.types import (
    FLOW_SIGNATURE_DIM,
    SPEAKER_ROLE_CUSTOMER,
    Conversation,
    ProcessedConversation,
)

MIN_CUSTOMER_TURN_LEN = 5


def run(upstream_manifest_path: str | None = None) -> dict[str, str]:
    start_time = time.time()
    runtime_config = PipelineRuntimeConfig.from_env()
    stage_context = read_stage_context(upstream_manifest_path, stage_name="preprocessing")
    logger = get_stage_logger(stage_context)
    conversations = list(read_ingestion_artifact(upstream_manifest_path))

    if not conversations:
        logger.warning("No ingestion conversations found for preprocessing.")

    processed, stats = _process_conversations(conversations, upstream_manifest_path)
    stats["processing_duration_seconds"] = time.time() - start_time
    artifact_manifest = write_preprocessed_artifact(stage_context, runtime_config, processed, stats)
    logger.info("Preprocessing completed: %s", stats)
    return artifact_manifest


def _process_conversations(
    conversations: Sequence[Conversation], upstream_manifest_path: str | None
) -> tuple[list[ProcessedConversation], dict[str, object]]:
    processed: list[ProcessedConversation] = []
    pii_masked_count = 0
    filtered_count = 0
    empty_customer_count = 0
    total_canonical_text_length = 0

    for conversation in conversations:
        processed_conversation, pii_count, customer_text_is_empty = _process_conversation(conversation)
        if customer_text_is_empty:
            empty_customer_count += 1

        processed.append(processed_conversation)
        if pii_count > 0:
            pii_masked_count += 1

        if processed_conversation.filtered:
            filtered_count += 1
            continue

        total_canonical_text_length += len(processed_conversation.canonical_text)

    output_count = len(processed) - filtered_count
    avg_canonical_text_length = total_canonical_text_length / output_count if output_count > 0 else 0.0

    return processed, {
        "input_count": len(conversations),
        "output_count": output_count,
        "filtered_count": filtered_count,
        "pii_masked_count": pii_masked_count,
        "empty_customer_text_count": empty_customer_count,
        "avg_canonical_text_length": avg_canonical_text_length,
        "upstream_manifest_path": upstream_manifest_path,
    }


def _process_conversation(conversation: Conversation) -> tuple[ProcessedConversation, int, bool]:
    normalized_conversation = _normalize_conversation(conversation)
    canonical_text, customer_text, pii_count = apply_canonicalization(normalized_conversation)
    customer_text_is_empty = not customer_text.strip()
    filtered = len(canonical_text) < MIN_CUSTOMER_TURN_LEN

    signature: np.ndarray = build_signature(normalized_conversation)
    if signature.shape != (FLOW_SIGNATURE_DIM,):
        raise ValueError(
            f"Expected flow signature shape ({FLOW_SIGNATURE_DIM},), got {signature.shape}"
        )
    if signature.dtype != np.float32:
        raise TypeError(
            f"Expected flow signature dtype float32, got {signature.dtype}"
        )

    normalized_turns = normalized_conversation.turns
    return (
        ProcessedConversation(
            id=normalized_conversation.conversation_id,
            dataset_id=normalized_conversation.dataset_id,
            channel=normalized_conversation.channel,
            ended_status=normalized_conversation.ended_status,
            canonical_text="" if filtered else canonical_text,
            customer_problem_text=customer_text,
            flow_signature=tuple(float(value) for value in cast(list[float], signature.tolist())),
            flow_signature_dim=FLOW_SIGNATURE_DIM,
            turn_count=len(normalized_turns),
            customer_turn_count=sum(1 for turn in normalized_turns if turn.speaker_role == SPEAKER_ROLE_CUSTOMER),
            pii_mask_count=pii_count,
            filtered=filtered,
        ),
        pii_count,
        customer_text_is_empty,
    )


def _normalize_conversation(conversation: Conversation) -> Conversation:
    normalized_turns = tuple(
        replace(turn, speaker_role=normalize_speaker_role(turn.speaker_role)) for turn in conversation.turns
    )
    return cast(Conversation, replace(conversation, turns=normalized_turns))
