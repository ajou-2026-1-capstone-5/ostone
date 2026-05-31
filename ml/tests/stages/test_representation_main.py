from __future__ import annotations

import json
from pathlib import Path
from typing import cast

import numpy as np

from pipeline.common.runtime import EmbeddingResult
from pipeline.stages.representation import main as representation
from pipeline.stages.representation.main import run


def test_representation_writes_semantic_embeddings_and_lineage(monkeypatch, tmp_path: Path) -> None:
    artifact_root = tmp_path / "artifacts"
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    preprocessing_dir = artifact_root / "domain_pack_generation" / "manual__run" / "preprocessing"
    preprocessing_dir.mkdir(parents=True)
    (preprocessing_dir / "preprocessed_data.json").write_text(
        json.dumps(
            {
                "conversations": [
                    {
                        "id": "c1",
                        "dataset_id": "5",
                        "channel": "chat",
                        "ended_status": "resolved",
                        "canonical_text": "고객: 배송 어디인가요\n상담사: 조회해드리겠습니다",
                        "customer_problem_text": "배송 어디인가요",
                        "flow_signature": [0.0] * 61,
                        "flow_signature_dim": 61,
                        "turn_count": 2,
                        "customer_turn_count": 1,
                        "pii_mask_count": 0,
                        "filtered": False,
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    upstream_manifest = preprocessing_dir / "manifest.json"
    upstream_manifest.write_text(
        json.dumps(
            {
                "dag_id": "domain_pack_generation",
                "run_id": "manual__run",
                "workspace_id": "3",
                "dataset_id": "5",
                "pipeline_job_id": "11",
                "payload": {"artifact_path": "preprocessed_data.json"},
            }
        ),
        encoding="utf-8",
    )

    class SuccessfulRuntime:
        model_name = "test-bge-m3"
        runtime_profile = "balanced"

        def embed(self, texts: list[str]) -> EmbeddingResult:
            return EmbeddingResult(
                embeddings=np.ones((len(texts), 768), dtype=np.float32),
                success_mask=[bool(text.strip()) for text in texts],
                model_name=self.model_name,
                runtime_profile=self.runtime_profile,
            )

    monkeypatch.setattr(representation, "build_embedding_runtime", lambda _runtime_config: SuccessfulRuntime())

    result = run(str(upstream_manifest))

    manifest_path = Path(cast(str, result["artifact_manifest_path"]))
    output_dir = manifest_path.parent
    embeddings = np.load(output_dir / "semantic_embeddings.npy")
    variants = np.load(output_dir / "semantic_embedding_variants.npz")
    index = json.loads((output_dir / "embedding_index.json").read_text(encoding="utf-8"))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    assert embeddings.shape == (1, 768)
    assert set(variants.files) >= {"role_weighted", "customer_only", "customer_dominant"}
    assert variants["customer_only"].shape == (1, 768)
    assert index[0]["conversationId"] == "c1"
    assert index[0]["embeddingSuccess"] is True
    assert index[0]["componentSuccess"]["customer"] is True
    assert manifest["schemaVersion"] == "artifact-manifest.v2"
    assert manifest["payload"]["recordCount"] == 1
    assert manifest["payload"]["semanticEmbeddingVariantsPath"] == "semantic_embedding_variants.npz"


def test_representation_keeps_conversation_when_agent_component_fails(monkeypatch, tmp_path: Path) -> None:
    artifact_root = tmp_path / "artifacts"
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    preprocessing_dir = artifact_root / "domain_pack_generation" / "manual__run" / "preprocessing"
    preprocessing_dir.mkdir(parents=True)
    (preprocessing_dir / "preprocessed_data.json").write_text(
        json.dumps(
            {
                "conversations": [
                    {
                        "id": "c1",
                        "dataset_id": "5",
                        "channel": "chat",
                        "ended_status": "resolved",
                        "canonical_text": "배송 문의",
                        "customer_problem_text": "배송 문의",
                        "flow_signature": [0.0] * 61,
                        "flow_signature_dim": 61,
                        "turn_count": 1,
                        "customer_turn_count": 1,
                        "pii_mask_count": 0,
                        "filtered": False,
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    upstream_manifest = preprocessing_dir / "manifest.json"
    upstream_manifest.write_text(
        json.dumps(
            {
                "dag_id": "domain_pack_generation",
                "run_id": "manual__run",
                "workspace_id": "3",
                "dataset_id": "5",
                "pipeline_job_id": "11",
                "payload": {"artifact_path": "preprocessed_data.json"},
            }
        ),
        encoding="utf-8",
    )

    class PartialRuntime:
        model_name = "partial"
        runtime_profile = "balanced"
        calls = 0

        def embed(self, texts: list[str]) -> EmbeddingResult:
            self.calls += 1
            success = self.calls != 4
            return EmbeddingResult(
                embeddings=np.ones((len(texts), 768), dtype=np.float32),
                success_mask=[success] * len(texts),
                model_name=self.model_name,
                runtime_profile=self.runtime_profile,
            )

    monkeypatch.setattr(representation, "build_embedding_runtime", lambda _runtime_config: PartialRuntime())

    result = run(str(upstream_manifest))

    manifest_path = Path(cast(str, result["artifact_manifest_path"]))
    index = json.loads((manifest_path.parent / "embedding_index.json").read_text(encoding="utf-8"))
    assert index[0]["embeddingSuccess"] is True
    assert index[0]["componentSuccess"]["agent"] is False
