from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from pipeline.stages.preprocessing.canonicalize import apply_canonicalization
from pipeline.stages.preprocessing.flow_signature import build_signature
from pipeline.stages.preprocessing.types import (
    SPEAKER_ROLE_CUSTOMER,
    Conversation,
    ConversationTurn,
    ProcessedConversation,
)

_FIXTURES_DIR = Path(__file__).resolve().parent.parent / "fixtures" / "raw-training"


def _load_raw_conversations(source_dir: Path) -> list[Conversation]:
    conversations: list[Conversation] = []
    for json_path in sorted(source_dir.glob("*.json")):
        raw = json.loads(json_path.read_text(encoding="utf-8"))
        for item in raw:
            turns: list[ConversationTurn] = []
            for line in item.get("consulting_content", "").strip().split("\n"):
                line = line.strip()
                if not line:
                    continue
                if ":" not in line:
                    continue
                speaker, _, text = line.partition(":")
                turn_id = f"{json_path.stem}_t{len(turns)}"
                turns.append(
                    ConversationTurn(
                        turn_id=turn_id,
                        speaker_role="agent" if "상담사" in speaker else "customer",
                        text=text.strip(),
                    )
                )
            if not turns:
                continue
            conversations.append(
                Conversation(
                    conversation_id=f"{json_path.stem}_{item.get('source_id', '0')}",
                    dataset_id=json_path.stem,
                    channel="chat",
                    turns=tuple(turns),
                )
            )
    return conversations


def _preprocess_conversations(conversations: list[Conversation]) -> list[ProcessedConversation]:
    processed: list[ProcessedConversation] = []
    for conv in conversations:
        canonical_text, customer_problem_text, pii_mask_count = apply_canonicalization(conv)
        if not customer_problem_text:
            customer_lines = [t.text for t in conv.turns if t.speaker_role == SPEAKER_ROLE_CUSTOMER]
            customer_problem_text = " ".join(customer_lines[:5])
        flow_sig = build_signature(conv)
        processed.append(
            ProcessedConversation(
                id=conv.conversation_id,
                dataset_id=conv.dataset_id,
                channel=conv.channel or "unknown",
                canonical_text=canonical_text,
                customer_problem_text=customer_problem_text,
                flow_signature=tuple(float(x) for x in flow_sig),
                flow_signature_dim=len(flow_sig),
                turn_count=len(conv.turns),
                customer_turn_count=sum(1 for t in conv.turns if t.speaker_role == SPEAKER_ROLE_CUSTOMER),
                pii_mask_count=pii_mask_count,
                filtered=False,
            )
        )
    return processed


def test_raw_training_ingests_and_preprocesses() -> None:
    conversations = _load_raw_conversations(_FIXTURES_DIR)
    assert len(conversations) >= 2, f"최소 2개 conversation 필요, 실제: {len(conversations)}"

    processed = _preprocess_conversations(conversations)
    assert len(processed) == len(conversations)
    for p in processed:
        assert p.canonical_text or p.customer_problem_text, f"{p.id} text 비어있음"
        assert p.flow_signature_dim > 0


def test_raw_training_runs_clustering() -> None:
    from pipeline.stages.intent_discovery.cluster_analysis import build_cluster_results
    from pipeline.stages.intent_discovery.clustering import (
        build_knn_graph,
        combine_with_flow,
        compute_centroids,
        detect_communities,
        identify_outliers,
    )
    from pipeline.stages.intent_discovery.evaluation import interpretability_score

    conversations = _load_raw_conversations(_FIXTURES_DIR)
    processed = _preprocess_conversations(conversations)

    rng = np.random.RandomState(42)
    dim = 768
    embeddings = rng.randn(len(processed), dim).astype(np.float32)
    flow_signatures = np.array([list(p.flow_signature) for p in processed], dtype=np.float32)
    vectors = combine_with_flow(embeddings, flow_signatures)

    graph = build_knn_graph(vectors, k=3)
    assert graph.vcount() == len(processed)
    assert graph.ecount() > 0

    memberships = detect_communities(graph, resolution=1.0)
    outlier_node_indices, valid_clusters = identify_outliers(memberships, min_size=2)
    centroids = compute_centroids(vectors, valid_clusters)

    cluster_results, novel_candidates = build_cluster_results(
        valid_clusters,
        set(outlier_node_indices),
        processed,
        vectors,
        centroids,
    )

    interp = interpretability_score(vectors, memberships)
    assert 0.0 <= interp <= 1.0, f"interpretability_score 범위 벗어남: {interp}"

    assert len(cluster_results) >= 1, "최소 1개 cluster 생성 필요"
    for cr in cluster_results:
        assert cr.suggested_name
        assert cr.quality.interpretability_score >= 0.0
