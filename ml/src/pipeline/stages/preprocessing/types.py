from __future__ import annotations

from dataclasses import KW_ONLY, dataclass

SPEAKER_ROLE_CUSTOMER = "customer"
SPEAKER_ROLE_AGENT = "agent"
SPEAKER_ROLE_SYSTEM = "system"

FLOW_SIGNATURE_DIM = 61


@dataclass(frozen=True)
class ConversationTurn:
    turn_id: str
    speaker_role: str
    text: str
    timestamp: str | None = None


@dataclass(frozen=True)
class Conversation:
    conversation_id: str
    dataset_id: str
    channel: str | None = None
    ended_status: str | None = None
    _: KW_ONLY
    turns: tuple[ConversationTurn, ...]


@dataclass(frozen=True)
class ProcessedConversation:
    id: str
    dataset_id: str
    channel: str | None = None
    ended_status: str | None = None
    _: KW_ONLY
    canonical_text: str
    customer_problem_text: str
    flow_signature: tuple[float, ...]
    flow_signature_dim: int
    turn_count: int
    customer_turn_count: int
    pii_mask_count: int
    filtered: bool
