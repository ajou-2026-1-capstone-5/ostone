from __future__ import annotations

# pyright: reportMissingImports=false, reportMissingTypeStubs=false, reportUnknownVariableType=false, reportUnknownMemberType=false, reportUnknownArgumentType=false
from collections.abc import Sequence
from dataclasses import replace
from pathlib import Path

from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.logging import get_stage_logger
from pipeline.stages.preprocessing.canonicalize import apply_canonicalization, normalize_speaker_role
from pipeline.stages.preprocessing.flow_signature import build_signature
from pipeline.stages.preprocessing.io import read_ingestion_artifact, write_preprocessed_artifact
from pipeline.stages.preprocessing.types import (
    FLOW_SIGNATURE_DIM,
    SPEAKER_ROLE_CUSTOMER,
    Conversation,
    ProcessedConversation,
)


def run(upstream_manifest_path: str | None = None) -> Path:
    runtime_config = PipelineRuntimeConfig.from_env()
    stage_context = StageContext(dag_id="pipeline_ml", run_id="preprocessing_run", stage_name="preprocessing")
    logger = get_stage_logger(stage_context)
    conversations = list(read_ingestion_artifact(upstream_manifest_path))

    if not conversations:
        logger.warning("No ingestion conversations found for preprocessing.")

    processed, stats = _process_conversations(conversations, upstream_manifest_path)
    output_path = write_preprocessed_artifact(stage_context, runtime_config, processed, stats)
    logger.info("Preprocessing completed: %s", stats)
    return output_path


def _process_conversations(
    conversations: Sequence[Conversation], upstream_manifest_path: str | None
) -> tuple[list[ProcessedConversation], dict[str, object]]:
    processed: list[ProcessedConversation] = []
    total_pii = 0
    filtered_count = 0
    empty_customer_count = 0

    for conversation in conversations:
        processed_conversation, pii_count, customer_text_is_empty = _process_conversation(conversation)
        if customer_text_is_empty:
            empty_customer_count += 1
        if processed_conversation is None:
            filtered_count += 1
            continue

        processed.append(processed_conversation)
        total_pii += pii_count

    return processed, {
        "input_count": len(conversations),
        "output_count": len(processed),
        "filtered_count": filtered_count,
        "pii_masked_count": total_pii,
        "empty_customer_text_count": empty_customer_count,
        "source_manifest": upstream_manifest_path,
        "upstream_manifest_path": upstream_manifest_path,
    }


def _process_conversation(conversation: Conversation) -> tuple[ProcessedConversation | None, int, bool]:
    normalized_conversation = _normalize_conversation(conversation)
    canonical_text, customer_text, pii_count = apply_canonicalization(normalized_conversation)
    customer_text_is_empty = not customer_text.strip()

    if len(canonical_text) < 5:
        return None, pii_count, customer_text_is_empty

    signature = build_signature(normalized_conversation)
    assert signature.shape == (FLOW_SIGNATURE_DIM,)
    assert str(signature.dtype) == "float32"

    normalized_turns = normalized_conversation.turns
    return (
        ProcessedConversation(
            id=normalized_conversation.conversation_id,
            dataset_id=normalized_conversation.dataset_id,
            channel=normalized_conversation.channel,
            ended_status=normalized_conversation.ended_status,
            canonical_text=canonical_text,
            customer_problem_text=customer_text,
            flow_signature=tuple(float(value) for value in signature),
            flow_signature_dim=FLOW_SIGNATURE_DIM,
            turn_count=len(normalized_turns),
            customer_turn_count=sum(1 for turn in normalized_turns if turn.speaker_role == SPEAKER_ROLE_CUSTOMER),
            pii_mask_count=pii_count,
            filtered=False,
        ),
        pii_count,
        customer_text_is_empty,
    )


def _normalize_conversation(conversation: Conversation) -> Conversation:
    normalized_turns = tuple(
        replace(turn, speaker_role=normalize_speaker_role(turn.speaker_role)) for turn in conversation.turns
    )
    return replace(conversation, turns=normalized_turns)
