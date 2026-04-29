from __future__ import annotations

from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.logging import get_stage_logger
from pipeline.stages.intent_discovery.cluster_analysis import build_cluster_results
from pipeline.stages.intent_discovery.clustering import (
    build_knn_graph,
    combine_with_flow,
    compute_centroids,
    detect_communities,
    identify_outliers,
)
from pipeline.stages.intent_discovery.embedding import embed_texts
from pipeline.stages.intent_discovery.evaluation import interpretability_score
from pipeline.stages.intent_discovery.io import read_preprocessed_artifact, write_clusters_artifact
from pipeline.stages.intent_discovery.types import (
    DEFAULT_KNN_K,
    DEFAULT_LEIDEN_RESOLUTION,
    IntentDiscoveryStats,
)


def run(upstream_manifest_path: str | None = None) -> IntentDiscoveryStats:
    runtime_config = PipelineRuntimeConfig.from_env()
    context = StageContext(
        dag_id="intent_discovery",
        run_id="manual",
        stage_name="intent_discovery",
    )
    logger = get_stage_logger(context)

    logger.info("Starting intent discovery stage")

    conversations, flow_signatures = read_preprocessed_artifact(runtime_config, context)
    logger.info("Loaded %d preprocessed conversations", len(conversations))

    texts = [c.canonical_text for c in conversations]
    embeddings, success_mask = embed_texts(texts)
    logger.info("Embedded %d/%d texts", sum(success_mask), len(texts))

    success_indices = [i for i, ok in enumerate(success_mask) if ok]
    embedding_vectors = embeddings[success_indices]
    flow_vectors = flow_signatures[success_indices]

    # 3. Hybrid vectors
    vectors = combine_with_flow(embedding_vectors, flow_vectors)
    logger.info("Built hybrid vectors shape=%s", list(vectors.shape))

    # 4. kNN graph
    graph = build_knn_graph(vectors, k=DEFAULT_KNN_K)
    logger.info("kNN graph: nodes=%d, edges=%d", graph.vcount(), graph.ecount())

    # 5. Leiden clustering
    memberships = detect_communities(graph, resolution=DEFAULT_LEIDEN_RESOLUTION)
    logger.info("Leiden detected %d communities", len(set(memberships)))

    # 6. Identify outliers
    outlier_node_indices, valid_clusters = identify_outliers(memberships)
    # Map back to original success_indices
    outlier_original = {success_indices[i] for i in outlier_node_indices}
    logger.info("Outlier count: %d, valid clusters: %d", len(outlier_node_indices), len(valid_clusters))

    # 7. Compute centroids
    centroids = compute_centroids(vectors, valid_clusters)

    # 8. Build cluster results (filter to success space only)
    success_conversations = [conversations[i] for i in success_indices]
    cluster_results, novel_candidates = build_cluster_results(
        valid_clusters,
        outlier_original,
        success_conversations,
        vectors,
        centroids,
    )
    logger.info("Built %d cluster results, %d novel candidates", len(cluster_results), len(novel_candidates))

    # 9. Evaluation
    interp_score = interpretability_score(vectors, memberships, centroids)
    avg_workflow = (
        sum(r.quality.workflow_consistency_score for r in cluster_results) / len(cluster_results)
        if cluster_results
        else 0.0
    )
    logger.info("Interpretability=%.3f, workflow_consistency=%.3f", interp_score, avg_workflow)

    # 10. Stats
    embedding_failed = sum(1 for ok in success_mask if not ok)
    outlier_count = len(outlier_node_indices)
    stats = IntentDiscoveryStats(
        input_count=len(conversations),
        embedding_failed_count=embedding_failed,
        cluster_count=len(cluster_results),
        outlier_count=outlier_count,
        outlier_rate=outlier_count / len(success_conversations) if success_conversations else 0.0,
        avg_interpretability_score=interp_score,
        avg_workflow_consistency_score=avg_workflow,
    )

    # 11. Write artifacts
    write_clusters_artifact(runtime_config, context, cluster_results, novel_candidates, stats, embedding_vectors)
    logger.info("Intent discovery stage completed: %s", stats)

    return stats
