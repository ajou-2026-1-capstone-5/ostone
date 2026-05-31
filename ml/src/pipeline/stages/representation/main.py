from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import numpy as np

from pipeline.common.artifacts import ensure_stage_directory, write_stage_manifest
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.runtime import build_embedding_runtime
from pipeline.stages.intent_discovery.io import read_preprocessed_artifact
from pipeline.stages.preprocessing.io import read_stage_context

SEMANTIC_EMBEDDINGS_ARTIFACT = "semantic_embeddings.npy"
SEMANTIC_VARIANTS_ARTIFACT = "semantic_embedding_variants.npz"
EMBEDDING_INDEX_ARTIFACT = "embedding_index.json"
FLOW_SIGNATURES_ARTIFACT = "flow_signatures.json"
REPRESENTATION_REPORT_ARTIFACT = "representation_report.json"


def run(upstream_manifest_path: str | None = None) -> dict[str, object]:
    start = time.monotonic()
    runtime_config = PipelineRuntimeConfig.from_env()
    stage_context = read_stage_context(upstream_manifest_path, stage_name="representation")
    output_dir = ensure_stage_directory(stage_context, runtime_config)
    conversations, flow_signatures = read_preprocessed_artifact(runtime_config, stage_context)

    runtime = build_embedding_runtime(runtime_config)
    customer_texts = [conversation.customer_problem_text for conversation in conversations]
    full_texts = [conversation.canonical_text for conversation in conversations]
    resolution_texts = [_resolution_text(conversation.canonical_text) for conversation in conversations]
    agent_texts = [
        _agent_proxy_text(conversation.canonical_text, conversation.customer_problem_text)
        for conversation in conversations
    ]

    customer_result = runtime.embed(customer_texts)
    full_result = runtime.embed(full_texts)
    resolution_result = runtime.embed(resolution_texts)
    agent_result = runtime.embed(agent_texts)

    semantic_variants = _semantic_variants(
        customer_result.embeddings,
        full_result.embeddings,
        resolution_result.embeddings,
        agent_result.embeddings,
    )
    semantic_embeddings = semantic_variants["role_weighted"]

    semantic_path = output_dir / SEMANTIC_EMBEDDINGS_ARTIFACT
    variants_path = output_dir / SEMANTIC_VARIANTS_ARTIFACT
    index_path = output_dir / EMBEDDING_INDEX_ARTIFACT
    flow_path = output_dir / FLOW_SIGNATURES_ARTIFACT
    report_path = output_dir / REPRESENTATION_REPORT_ARTIFACT

    np.save(semantic_path, semantic_embeddings)
    variant_payload: dict[str, Any] = dict(semantic_variants)
    np.savez_compressed(variants_path, **variant_payload)
    index_payload = [
        {
            "rowIndex": index,
            "conversationId": conversation.id,
            "datasetId": conversation.dataset_id,
            "embeddingSuccess": any(
                (
                    customer_result.success_mask[index],
                    full_result.success_mask[index],
                )
            ),
            "componentSuccess": {
                "customer": customer_result.success_mask[index],
                "fullDialogue": full_result.success_mask[index],
                "resolution": resolution_result.success_mask[index],
                "agent": agent_result.success_mask[index],
            },
        }
        for index, conversation in enumerate(conversations)
    ]
    index_path.write_text(json.dumps(index_payload, indent=2, ensure_ascii=False), encoding="utf-8")
    flow_path.write_text(
        json.dumps(
            [
                {"conversationId": conversation.id, "flowSignature": [float(value) for value in flow_signatures[index]]}
                for index, conversation in enumerate(conversations)
            ],
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    success_count = sum(1 for item in index_payload if item["embeddingSuccess"])
    report: dict[str, Any] = {
        "schemaVersion": "representation.v2",
        "stage": "representation",
        "modelName": runtime.model_name,
        "embeddingRuntime": runtime_config.embedding_runtime,
        "runtimeProfile": runtime.runtime_profile,
        "conversationCount": len(conversations),
        "embeddingCount": success_count,
        "embeddingFailureCount": len(conversations) - success_count,
        "semanticWeights": {
            "customer": 0.45,
            "fullDialogue": 0.20,
            "resolution": 0.20,
            "agent": 0.15,
        },
        "semanticVariants": _variant_metadata(),
        "durationSeconds": time.monotonic() - start,
    }
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    manifest_path = write_stage_manifest(
        stage_context,
        runtime_config,
        {
            "upstream_manifest_path": upstream_manifest_path,
            "semanticEmbeddingsPath": semantic_path.name,
            "semanticEmbeddingVariantsPath": variants_path.name,
            "embeddingIndexPath": index_path.name,
            "flowSignaturesPath": flow_path.name,
            "reportPath": report_path.name,
            "embedding_count": success_count,
            "recordCount": len(conversations),
            "metrics": report,
        },
    )
    return {"artifact_manifest_path": str(manifest_path.resolve())}


def _resolution_text(text: str) -> str:
    parts = [part.strip() for part in text.splitlines() if part.strip()]
    return "\n".join(parts[-4:]) if parts else text


def _agent_proxy_text(canonical_text: str, customer_text: str) -> str:
    if canonical_text == customer_text:
        return canonical_text
    return canonical_text.replace(customer_text, "").strip() or canonical_text


def _semantic_variants(
    customer_embeddings: np.ndarray,
    full_embeddings: np.ndarray,
    resolution_embeddings: np.ndarray,
    agent_embeddings: np.ndarray,
) -> dict[str, np.ndarray]:
    raw_variants = {
        "role_weighted": (
            customer_embeddings * 0.45 + full_embeddings * 0.20 + resolution_embeddings * 0.20 + agent_embeddings * 0.15
        ),
        "customer_only": customer_embeddings,
        "customer_full": customer_embeddings * 0.70 + full_embeddings * 0.30,
        "customer_resolution": customer_embeddings * 0.70 + resolution_embeddings * 0.30,
        "customer_full_resolution": (
            customer_embeddings * 0.55 + full_embeddings * 0.25 + resolution_embeddings * 0.20
        ),
        "customer_dominant": (
            customer_embeddings * 0.70 + full_embeddings * 0.15 + resolution_embeddings * 0.10 + agent_embeddings * 0.05
        ),
    }
    return {name: _l2norm(values.astype(np.float32, copy=False)) for name, values in raw_variants.items()}


def _variant_metadata() -> dict[str, dict[str, float]]:
    return {
        "role_weighted": {"customer": 0.45, "fullDialogue": 0.20, "resolution": 0.20, "agent": 0.15},
        "customer_only": {"customer": 1.00, "fullDialogue": 0.00, "resolution": 0.00, "agent": 0.00},
        "customer_full": {"customer": 0.70, "fullDialogue": 0.30, "resolution": 0.00, "agent": 0.00},
        "customer_resolution": {"customer": 0.70, "fullDialogue": 0.00, "resolution": 0.30, "agent": 0.00},
        "customer_full_resolution": {"customer": 0.55, "fullDialogue": 0.25, "resolution": 0.20, "agent": 0.00},
        "customer_dominant": {"customer": 0.70, "fullDialogue": 0.15, "resolution": 0.10, "agent": 0.05},
    }


def _l2norm(vectors: np.ndarray) -> np.ndarray:
    values = vectors.astype(np.float32, copy=True)
    norms = np.linalg.norm(values, axis=1, keepdims=True)
    normalized = np.zeros_like(values, dtype=np.float32)
    _ = np.divide(values, norms, out=normalized, where=norms > 0.0)
    return normalized.astype(np.float32, copy=False)


def representation_stage_dir(runtime_config: PipelineRuntimeConfig, context: StageContext) -> Path:
    upstream = StageContext(
        dag_id=context.dag_id,
        run_id=context.run_id,
        stage_name="representation",
        workspace_id=context.workspace_id,
        dataset_id=context.dataset_id,
        pipeline_job_id=context.pipeline_job_id,
    )
    return upstream.artifact_dir(runtime_config)


__all__ = [
    "EMBEDDING_INDEX_ARTIFACT",
    "FLOW_SIGNATURES_ARTIFACT",
    "REPRESENTATION_REPORT_ARTIFACT",
    "SEMANTIC_EMBEDDINGS_ARTIFACT",
    "SEMANTIC_VARIANTS_ARTIFACT",
    "representation_stage_dir",
    "run",
]
