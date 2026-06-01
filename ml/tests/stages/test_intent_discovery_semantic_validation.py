from __future__ import annotations

import numpy as np

from pipeline.stages.intent_discovery.semantic_validation import build_semantic_quality_report


def test_semantic_quality_report_marks_non_bge_runtime_as_structure_only() -> None:
    vectors = np.asarray(
        [
            [1.0, 0.0],
            [0.9, 0.1],
            [0.0, 1.0],
            [0.1, 0.9],
        ],
        dtype=np.float32,
    )

    report = build_semantic_quality_report(
        semantic_embeddings=vectors,
        valid_clusters={1: [0, 1], 2: [2, 3]},
        embedding_runtime="external_api",
        embedding_model_name="BAAI/bge-m3",
        embedding_source="representation",
    )

    assert report["finalSemanticQuality"] is False
    assert report["status"] == "structure_only_embedding"
    assert report["blockingReason"] == "semantic_embedding_runtime_not_bge_m3"
    assert report["meanClusterCohesion"] is not None
    assert report["semanticSilhouetteProxy"] is not None
    assert len(report["clusters"]) == 2


def test_semantic_quality_report_marks_bge_runtime_as_final_validation() -> None:
    vectors = np.asarray([[1.0, 0.0], [0.0, 1.0]], dtype=np.float32)

    report = build_semantic_quality_report(
        semantic_embeddings=vectors,
        valid_clusters={1: [0], 2: [1]},
        embedding_runtime="flag_embedding",
        embedding_model_name="BAAI/bge-m3",
        embedding_source="representation",
    )

    assert report["finalSemanticQuality"] is True
    assert report["status"] == "final_semantic_validation"
    assert report["blockingReason"] is None


def test_semantic_quality_report_marks_local_http_bge_runtime_as_final_validation() -> None:
    vectors = np.asarray([[1.0, 0.0], [0.0, 1.0]], dtype=np.float32)

    report = build_semantic_quality_report(
        semantic_embeddings=vectors,
        valid_clusters={1: [0], 2: [1]},
        embedding_runtime="local_http",
        embedding_model_name="BAAI/bge-m3",
        embedding_source="representation",
    )

    assert report["finalSemanticQuality"] is True
    assert report["status"] == "final_semantic_validation"
    assert report["blockingReason"] is None
