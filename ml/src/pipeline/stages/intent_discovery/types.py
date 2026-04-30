from __future__ import annotations

from dataclasses import dataclass

from ..preprocessing.types import FLOW_SIGNATURE_DIM, ProcessedConversation


@dataclass(frozen=True)
class ClusterQuality:
    interpretability_score: float
    workflow_consistency_score: float
    branching_explainability_score: float | None


@dataclass(frozen=True)
class ClusterResult:
    cluster_id: int
    member_indices: tuple[int, ...]
    member_conv_ids: tuple[str, ...]
    exemplar_indices: tuple[int, ...]
    keywords: tuple[str, ...]
    suggested_name: str
    suggested_description: str
    workflow_signal: dict[str, bool]
    quality: ClusterQuality
    review_hint: str | None = None


@dataclass(frozen=True)
class NovelIntentCandidate:
    candidate_key: str
    source_type: str
    candidate_size: int
    suggested_name: str
    member_conv_ids: tuple[str, ...]


@dataclass(frozen=True)
class IntentDiscoveryStats:
    input_count: int
    embedding_failed_count: int
    cluster_count: int
    outlier_count: int
    outlier_rate: float
    avg_interpretability_score: float
    avg_workflow_consistency_score: float


DEFAULT_KNN_K = 15
DEFAULT_LEIDEN_RESOLUTION = 1.0
DEFAULT_MIN_CLUSTER_SIZE = 5
DEFAULT_TFIDF_TOP_KEYWORDS = 8
DEFAULT_EMBEDDING_BATCH_SIZE = 32
OUTCOME_LABELS = ("resolved", "escalated", "unknown")
WORKFLOW_SIGNAL_KEYS = (
    "requires_payment_check",
    "requires_user_identification",
    "has_escalation_cases",
)

__all__ = [
    "ClusterQuality",
    "ClusterResult",
    "DEFAULT_EMBEDDING_BATCH_SIZE",
    "DEFAULT_KNN_K",
    "DEFAULT_LEIDEN_RESOLUTION",
    "DEFAULT_MIN_CLUSTER_SIZE",
    "DEFAULT_TFIDF_TOP_KEYWORDS",
    "FLOW_SIGNATURE_DIM",
    "IntentDiscoveryStats",
    "NovelIntentCandidate",
    "OUTCOME_LABELS",
    "ProcessedConversation",
    "WORKFLOW_SIGNAL_KEYS",
]
