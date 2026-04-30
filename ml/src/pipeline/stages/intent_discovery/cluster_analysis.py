from __future__ import annotations

# pyright: reportMissingTypeStubs=false, reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false, reportAny=false
from collections import defaultdict
from typing import TypedDict

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer  # type: ignore[import-untyped]

from pipeline.stages.intent_discovery.evaluation import (
    branching_explainability_score,
    interpretability_score,
    workflow_consistency_score,
)
from pipeline.stages.intent_discovery.types import (
    DEFAULT_TFIDF_TOP_KEYWORDS,
    WORKFLOW_SIGNAL_KEYS,
    ClusterQuality,
    ClusterResult,
    NovelIntentCandidate,
    ProcessedConversation,
)


class ClusterResultData(TypedDict):
    cluster_id: int
    member_indices: tuple[int, ...]
    member_conv_ids: tuple[str, ...]
    exemplar_indices: tuple[int, ...]
    keywords: tuple[str, ...]
    suggested_name: str
    suggested_description: str
    workflow_signal: dict[str, bool]
    quality: ClusterQuality


def build_cluster_results(
    valid_clusters: dict[int, list[int]],
    outlier_node_indices: set[int],
    conversations: list[ProcessedConversation],
    vectors: np.ndarray,
    centroids: dict[int, np.ndarray],
    top_keywords: int = DEFAULT_TFIDF_TOP_KEYWORDS,
    workflow_signal_keys: tuple[str, ...] = WORKFLOW_SIGNAL_KEYS,
) -> tuple[list[ClusterResult], list[NovelIntentCandidate]]:
    """Return (cluster_results, novel_candidates)."""

    cluster_results = [
        ClusterResult(
            **analyze_cluster(
                cluster_id,
                member_indices,
                conversations,
                vectors,
                centroids,
                top_keywords,
                workflow_signal_keys,
            )
        )
        for cluster_id, member_indices in sorted(valid_clusters.items())
        if cluster_id in centroids
    ]
    novel_candidates = _novel_intent_candidates(conversations, outlier_node_indices)
    return cluster_results, novel_candidates


def analyze_cluster(
    cluster_id: int,
    member_indices: list[int],
    conversations: list[ProcessedConversation],
    vectors: np.ndarray,
    centroids: dict[int, np.ndarray],
    top_keywords: int = DEFAULT_TFIDF_TOP_KEYWORDS,
    workflow_signal_keys: tuple[str, ...] = WORKFLOW_SIGNAL_KEYS,
) -> ClusterResultData:
    centroid = centroids[cluster_id]
    keywords = _top_keywords(member_indices, conversations, top_keywords)
    workflow_signal = _workflow_signal(member_indices, conversations, workflow_signal_keys)
    suggested_name = _suggested_name(cluster_id, keywords, workflow_signal)

    return {
        "cluster_id": cluster_id,
        "member_indices": tuple(member_indices),
        "member_conv_ids": _member_conv_ids(member_indices, conversations),
        "exemplar_indices": _exemplar_indices(member_indices, centroid, vectors),
        "keywords": keywords,
        "suggested_name": suggested_name,
        "suggested_description": f"{suggested_name} 클러스터",
        "workflow_signal": workflow_signal,
        "quality": ClusterQuality(
            interpretability_score=interpretability_score(vectors, member_indices),
            workflow_consistency_score=workflow_consistency_score(conversations, {cluster_id: member_indices}).get(
                "avg_consistency", 0.0
            ),
            branching_explainability_score=branching_explainability_score(vectors, member_indices),
        ),
    }


def _exemplar_indices(member_indices: list[int], centroid: np.ndarray, vectors: np.ndarray) -> tuple[int, ...]:
    if not member_indices:
        return ()

    centroid_norm = float(np.linalg.norm(centroid))
    if centroid_norm < 1e-9:
        return tuple(member_indices[:2])

    similarities = _cosine_similarities(vectors[member_indices], centroid, centroid_norm)
    ranked_positions = np.argsort(-similarities, kind="stable")[:2]
    return tuple(member_indices[int(position)] for position in ranked_positions)


def _top_keywords(
    member_indices: list[int],
    conversations: list[ProcessedConversation],
    top_k: int = DEFAULT_TFIDF_TOP_KEYWORDS,
) -> tuple[str, ...]:
    texts = [conversations[index].canonical_text for index in member_indices if _has_conversation(index, conversations)]
    texts = [text for text in texts if text.strip()]
    if not texts or top_k <= 0:
        return ()

    vectorizer = TfidfVectorizer(ngram_range=(1, 2), max_features=20, stop_words=None)
    try:
        tfidf_matrix = vectorizer.fit_transform(texts)
    except ValueError:
        return ()

    scores = np.asarray(tfidf_matrix.sum(axis=0), dtype=np.float64).ravel()  # pyright: ignore[reportAttributeAccessIssue]
    features = vectorizer.get_feature_names_out()
    ranked_indices = np.argsort(-scores, kind="stable")[:top_k]
    return tuple(str(features[int(index)]) for index in ranked_indices if scores[int(index)] > 0.0)


def _workflow_signal(
    member_indices: list[int],
    conversations: list[ProcessedConversation],
    workflow_signal_keys: tuple[str, ...] = WORKFLOW_SIGNAL_KEYS,
) -> dict[str, bool]:
    members = [conversations[index] for index in member_indices if _has_conversation(index, conversations)]
    text = " ".join(conversation.canonical_text.casefold() for conversation in members)
    values = {
        "requires_payment_check": any(keyword in text for keyword in ("결제", "payment", "환불", "refund", "환급")),
        "requires_user_identification": any(
            keyword in text for keyword in ("본인인증", "identity", "휴대폰 인증", "本人인증")
        ),
        "has_escalation_cases": any(conversation.ended_status == "escalated" for conversation in members),
    }
    return {key: values.get(key, False) for key in workflow_signal_keys}


def _suggested_name(cluster_id: int, keywords: tuple[str, ...], workflow_signal: dict[str, bool]) -> str:
    _ = workflow_signal
    if not keywords:
        return f"미분류_{cluster_id}"
    return f"{keywords[0]} 관련 문의"


def _novel_intent_candidates(
    conversations: list[ProcessedConversation],
    outlier_indices: set[int],
    min_size: int = 5,
) -> list[NovelIntentCandidate]:
    grouped_indices: dict[str, list[int]] = defaultdict(list)
    for index in sorted(outlier_indices):
        if not _has_conversation(index, conversations):
            continue
        conversation = conversations[index]
        status = conversation.ended_status or conversation.channel or "unknown"
        grouped_indices[status].append(index)

    candidates: list[NovelIntentCandidate] = []
    for status, indices in sorted(grouped_indices.items()):
        if len(indices) < min_size:
            continue
        source_type = "outlier_status"
        candidates.append(
            NovelIntentCandidate(
                candidate_key=f"{source_type}:{status}:{len(indices)}",
                source_type=source_type,
                candidate_size=len(indices),
                suggested_name=f"{status} 미분류 문의",
                member_conv_ids=_member_conv_ids(indices, conversations),
            )
        )
    return candidates


def _cosine_similarities(member_vectors: np.ndarray, centroid: np.ndarray, centroid_norm: float) -> np.ndarray:
    values = member_vectors.astype(np.float32, copy=False)
    norms = np.linalg.norm(values, axis=1)
    similarities = np.zeros((values.shape[0],), dtype=np.float32)
    _ = np.divide(values @ centroid, norms * centroid_norm, out=similarities, where=norms > 0.0)
    return similarities


def _member_conv_ids(member_indices: list[int], conversations: list[ProcessedConversation]) -> tuple[str, ...]:
    return tuple(conversations[index].id for index in member_indices if _has_conversation(index, conversations))


def _has_conversation(index: int, conversations: list[ProcessedConversation]) -> bool:
    return 0 <= index < len(conversations)


__all__ = [
    "analyze_cluster",
    "build_cluster_results",
]
