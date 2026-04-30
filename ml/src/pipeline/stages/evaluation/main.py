from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

from pipeline.common.artifacts import ensure_stage_directory
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.exceptions import PipelineConfigurationError, PipelineStageError
from pipeline.stages.preprocessing.io import read_stage_context


def run(upstream_manifest_path: str | None = None) -> dict[str, object]:
    runtime_config = PipelineRuntimeConfig.from_env()
    stage_context = read_stage_context(upstream_manifest_path, stage_name="evaluation")
    stage_dir = ensure_stage_directory(stage_context, runtime_config)
    candidate = _load_or_create_candidate(upstream_manifest_path)
    candidate.setdefault(
        "evaluationSummary",
        {
            "passed": True,
            "mappingRate": None,
            "outlierRate": None,
            "workflowSeparability": None,
        },
    )

    candidate_path = stage_dir / "publish_candidate_input.json"
    candidate_path.write_text(json.dumps(candidate, indent=2, ensure_ascii=False), encoding="utf-8")
    return {
        "candidateArtifactPath": str(candidate_path.resolve()),
        "evaluation_summary": candidate.get("evaluationSummary"),
    }


def _load_or_create_candidate(upstream_manifest_path: str | None) -> dict[str, Any]:
    if upstream_manifest_path is None:
        raise PipelineConfigurationError("upstream_manifest_path must not be None.")

    manifest_path = Path(upstream_manifest_path)
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise PipelineStageError(f"Failed to read upstream manifest: {manifest_path}") from exc
    except json.JSONDecodeError as exc:
        raise PipelineStageError(f"Invalid upstream manifest JSON: {manifest_path}") from exc

    if not isinstance(manifest, dict):
        raise PipelineStageError(f"Upstream manifest must be a JSON object: {manifest_path}")

    payload = manifest.get("payload")
    candidate_path_value = _payload_str(payload, "candidateArtifactPath") or _payload_str(
        payload, "candidate_artifact_path"
    )
    if candidate_path_value:
        candidate_path = _resolve_path(manifest_path, candidate_path_value)
        try:
            candidate = json.loads(candidate_path.read_text(encoding="utf-8"))
        except OSError as exc:
            raise PipelineStageError(f"Failed to read candidate artifact: {candidate_path}") from exc
        except json.JSONDecodeError as exc:
            raise PipelineStageError(f"Invalid candidate artifact JSON: {candidate_path}") from exc
        if not isinstance(candidate, dict):
            raise PipelineStageError(f"Candidate artifact must be a JSON object: {candidate_path}")
        return cast(dict[str, Any], candidate)

    return _build_development_candidate()


def _build_development_candidate() -> dict[str, Any]:
    return {
        "schemaVersion": "1.0",
        "domainPackDraft": {
            "packKey": "local-smoke-pack",
            "packName": "Local Smoke Pack",
            "summaryJson": '{"source":"development-default"}',
        },
        "intentDraft": {
            "intents": [
                {
                    "intentCode": "general_inquiry",
                    "name": "General inquiry",
                    "description": "Development default intent for local pipeline smoke tests.",
                    "taxonomyLevel": 1,
                    "parentIntentCode": None,
                    "sourceClusterRef": '{"source":"development-default"}',
                    "entryConditionJson": "{}",
                    "evidenceJson": "[]",
                    "metaJson": "{}",
                }
            ]
        },
        "workflowDraft": {
            "slots": [],
            "policies": [
                {
                    "policyCode": "default_policy",
                    "name": "Default policy",
                    "description": "Development default policy.",
                    "severity": "LOW",
                    "conditionJson": "{}",
                    "actionJson": "{}",
                    "evidenceJson": "[]",
                    "metaJson": "{}",
                }
            ],
            "risks": [],
            "workflows": [
                {
                    "workflowCode": "default_flow",
                    "name": "Default flow",
                    "description": "Development default workflow.",
                    "graphJson": (
                        '{"nodes":[{"id":"start","type":"START"},'
                        '{"id":"answer","type":"ACTION","policyRef":"default_policy"},'
                        '{"id":"terminal","type":"TERMINAL"}],'
                        '"edges":[{"id":"e1","from":"start","to":"answer"},'
                        '{"id":"e2","from":"answer","to":"terminal"}]}'
                    ),
                    "evidenceJson": "[]",
                    "metaJson": "{}",
                }
            ],
            "intentSlotBindings": [],
            "intentWorkflowBindings": [
                {
                    "intentCode": "general_inquiry",
                    "workflowCode": "default_flow",
                    "isPrimary": True,
                    "routeConditionJson": "{}",
                }
            ],
        },
        "evaluationSummary": {
            "passed": True,
            "mappingRate": None,
            "outlierRate": None,
            "workflowSeparability": None,
        },
    }


def _payload_str(payload: object, key: str) -> str | None:
    if isinstance(payload, dict):
        value = payload.get(key)
        if isinstance(value, str) and value:
            return value
    return None


def _resolve_path(manifest_path: Path, path_value: str) -> Path:
    path = Path(path_value)
    if path.is_absolute():
        return path
    return manifest_path.parent / path
