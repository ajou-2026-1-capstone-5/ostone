from __future__ import annotations

import os

from pipeline.common.artifacts import ensure_stage_directory
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.logging import get_stage_logger
from pipeline.stages.intent_discovery.boundary_segments import (
    discover_boundary_segments,
    load_ingestion_conversation_index,
    write_boundary_artifacts,
)
from pipeline.stages.intent_discovery.io import read_preprocessed_artifact, write_clusters_artifact
from pipeline.stages.preprocessing.io import read_stage_context

MANIFEST_FILENAME = "manifest.json"


def run(upstream_manifest_path: str | None = None) -> dict[str, object]:
    runtime_config = PipelineRuntimeConfig.from_env()
    context = read_stage_context(upstream_manifest_path, stage_name="intent_discovery")
    logger = get_stage_logger(context)
    mode = os.getenv("PIPELINE_INTENT_DISCOVERY_MODE", "boundary_segment").strip().lower()

    logger.info("Starting intent discovery stage mode=%s", mode)
    if mode == "legacy_embedding":
        return _run_legacy_embedding(runtime_config, context)
    return _run_boundary_segment(runtime_config, context)


def _run_boundary_segment(
    runtime_config: PipelineRuntimeConfig,
    context: StageContext,
) -> dict[str, object]:
    logger = get_stage_logger(context)
    preprocessed, _flow_signatures = read_preprocessed_artifact(runtime_config, context)
    conversation_index = load_ingestion_conversation_index(runtime_config, context, preprocessed)
    ordered_conversations = [
        conversation_index[conversation.id] for conversation in preprocessed if conversation.id in conversation_index
    ]

    result = discover_boundary_segments(ordered_conversations)
    if not result.segments:
        logger.warning("Boundary segment discovery produced no segments")

    output_dir = ensure_stage_directory(context, runtime_config)
    extra_manifest_payload = write_boundary_artifacts(output_dir, result)
    clusters_path = write_clusters_artifact(
        runtime_config,
        context,
        result.clusters,
        [],
        result.stats,
        result.embeddings,
        extra_manifest_payload=extra_manifest_payload,
    )
    logger.info(
        "Intent discovery boundary segment stage completed: segments=%d clusters=%d",
        len(result.segments),
        len(result.clusters),
    )
    return {"artifact_manifest_path": str((clusters_path.parent / MANIFEST_FILENAME).resolve())}


def _run_legacy_embedding(
    runtime_config: PipelineRuntimeConfig,
    context: StageContext,
) -> dict[str, object]:
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
    from pipeline.stages.intent_discovery.types import (
        DEFAULT_KNN_K,
        DEFAULT_LEIDEN_RESOLUTION,
        IntentDiscoveryStats,
    )

    logger = get_stage_logger(context)
    conversations, flow_signatures = read_preprocessed_artifact(runtime_config, context)
    logger.info("Loaded %d preprocessed conversations", len(conversations))

    texts = [conversation.canonical_text for conversation in conversations]
    embeddings, success_mask = embed_texts(texts)
    logger.info("Embedded %d/%d texts", sum(success_mask), len(texts))

    success_indices = [index for index, ok in enumerate(success_mask) if ok]
    embedding_vectors = embeddings[success_indices]
    flow_vectors = flow_signatures[success_indices]
    success_conversations = [conversations[index] for index in success_indices]

    if embedding_vectors.shape[0] == 0:
        stats = IntentDiscoveryStats(
            input_count=len(conversations),
            embedding_failed_count=len(conversations),
            cluster_count=0,
            outlier_count=0,
            outlier_rate=0.0,
            avg_interpretability_score=0.0,
            avg_workflow_consistency_score=0.0,
        )
        clusters_path = write_clusters_artifact(runtime_config, context, [], [], stats, embedding_vectors)
        logger.warning("No successful embeddings; wrote empty intent-discovery artifacts")
        return {"artifact_manifest_path": str((clusters_path.parent / MANIFEST_FILENAME).resolve())}

    vectors = combine_with_flow(embedding_vectors, flow_vectors)
    logger.info("Built hybrid vectors shape=%s", list(vectors.shape))

    graph = build_knn_graph(vectors, k=DEFAULT_KNN_K)
    logger.info("kNN graph: nodes=%d, edges=%d", graph.vcount(), graph.ecount())

    memberships = detect_communities(graph, resolution=DEFAULT_LEIDEN_RESOLUTION)
    logger.info("Leiden detected %d communities", len(set(memberships)))

    outlier_node_indices, valid_clusters = identify_outliers(memberships)
    logger.info("Outlier count: %d, valid clusters: %d", len(outlier_node_indices), len(valid_clusters))

    centroids = compute_centroids(vectors, valid_clusters)
    cluster_results, novel_candidates = build_cluster_results(
        valid_clusters,
        outlier_node_indices,
        success_conversations,
        vectors,
        centroids,
    )
    logger.info("Built %d cluster results, %d novel candidates", len(cluster_results), len(novel_candidates))

    interp_score = interpretability_score(vectors, memberships, centroids)
    avg_workflow = (
        sum(result.quality.workflow_consistency_score for result in cluster_results) / len(cluster_results)
        if cluster_results
        else 0.0
    )
    logger.info("Interpretability=%.3f, workflow_consistency=%.3f", interp_score, avg_workflow)

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

    clusters_path = write_clusters_artifact(
        runtime_config,
        context,
        cluster_results,
        novel_candidates,
        stats,
        embeddings,
    )
    logger.info("Intent discovery legacy embedding stage completed: %s", stats)
    return {"artifact_manifest_path": str((clusters_path.parent / MANIFEST_FILENAME).resolve())}
