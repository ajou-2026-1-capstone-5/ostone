from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

from pipeline.common.artifacts import ensure_stage_directory
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.exceptions import PipelineConfigurationError, PipelineStageError
from pipeline.stages.preprocessing.io import read_stage_context

MAPPING_RATE_THRESHOLD = 0.75
OUTLIER_RATE_THRESHOLD = 0.25
WORKFLOW_SEPARABILITY_THRESHOLD = 0.65
EVIDENCE_COVERAGE_THRESHOLD = 0.80
LLM_SCHEMA_VALIDITY_THRESHOLD = 0.95
DEFAULT_DEV_EVIDENCE_JSON = '[{"conversationId":"development-default","turnIds":[]}]'


def run(upstream_manifest_path: str | None = None) -> dict[str, object]:
    if upstream_manifest_path is None:
        raise PipelineConfigurationError("evaluation stage requires an upstream manifest path.")
    runtime_config = PipelineRuntimeConfig.from_env()
    stage_context = read_stage_context(upstream_manifest_path, stage_name="evaluation")
    stage_dir = ensure_stage_directory(stage_context, runtime_config)
    candidate = _load_or_create_candidate(upstream_manifest_path)
    candidate["evaluationSummary"] = _evaluate_candidate(candidate)

    candidate_path = stage_dir / "publish_candidate_input.json"
    candidate_path.write_text(json.dumps(candidate, indent=2, ensure_ascii=False), encoding="utf-8")
    return {
        "candidateArtifactPath": str(candidate_path.resolve()),
        "evaluation_summary": candidate.get("evaluationSummary"),
    }


def _load_or_create_candidate(upstream_manifest_path: str) -> dict[str, Any]:
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
                    "evidenceJson": DEFAULT_DEV_EVIDENCE_JSON,
                    "metaJson": "{}",
                    "representativeCases": [],
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
                    "evidenceJson": DEFAULT_DEV_EVIDENCE_JSON,
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
                        '{"direction":"LR","nodes":[{"id":"start","type":"START","label":"시작"},'
                        '{"id":"answer","type":"ACTION","label":"Default flow","policyRef":"default_policy"},'
                        '{"id":"terminal","type":"TERMINAL","label":"종료"}],'
                        '"edges":[{"id":"e1","from":"start","to":"answer"},'
                        '{"id":"e2","from":"answer","to":"terminal"}]}'
                    ),
                    "evidenceJson": DEFAULT_DEV_EVIDENCE_JSON,
                    "metaJson": "{}",
                    "intentCode": "general_inquiry",
                    "isPrimary": True,
                    "routeConditionJson": "{}",
                }
            ],
            "intentSlotBindings": [],
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


def _evaluate_candidate(candidate: dict[str, Any]) -> dict[str, Any]:
    workflows = _workflow_items(candidate)
    intents = _intent_items(candidate)
    policies = _policy_items(candidate)
    risks = _risk_items(candidate)
    draft_entities = intents + workflows + policies + risks

    block_reasons: list[str] = []
    graph_validity = _graph_validity(workflows)
    if graph_validity != "passed":
        block_reasons.append("graph_validity_failed")

    evidence_coverage = _evidence_coverage(draft_entities)
    if evidence_coverage < EVIDENCE_COVERAGE_THRESHOLD:
        block_reasons.append("evidence_coverage_below_threshold")

    if _pii_redaction_failed(candidate):
        block_reasons.append("pii_redaction_failed")

    if _has_auto_confirmed_unsupported_policy_or_risk(policies + risks):
        block_reasons.append("unsupported_policy_or_risk")

    llm_schema_validity = _llm_schema_validity(candidate)
    if llm_schema_validity < LLM_SCHEMA_VALIDITY_THRESHOLD:
        block_reasons.append("llm_schema_validation_failed")

    mapping_rate = _mapping_rate(intents, workflows)
    outlier_rate = _metric(candidate, "outlierRate")
    workflow_separability = _metric(candidate, "workflowSeparability")
    if mapping_rate < MAPPING_RATE_THRESHOLD:
        block_reasons.append("mapping_rate_below_threshold")
    if outlier_rate is not None and outlier_rate > OUTLIER_RATE_THRESHOLD:
        block_reasons.append("outlier_rate_above_threshold")
    if workflow_separability is not None and workflow_separability < WORKFLOW_SEPARABILITY_THRESHOLD:
        block_reasons.append("workflow_separability_below_threshold")
    passed = not block_reasons
    return {
        "passed": passed,
        "mappingRate": mapping_rate,
        "outlierRate": outlier_rate,
        "workflowSeparability": workflow_separability,
        "evidenceCoverage": evidence_coverage,
        "graphValidity": graph_validity,
        "llmSchemaValidity": llm_schema_validity,
        "llmRepairRate": _metric(candidate, "llmRepairRate"),
        "humanReviewRejectionRate": _metric(candidate, "humanReviewRejectionRate"),
        "blockReasons": block_reasons,
    }


def _intent_items(candidate: dict[str, Any]) -> list[dict[str, Any]]:
    intent_draft = candidate.get("intentDraft")
    if not isinstance(intent_draft, dict):
        return []
    return _dict_items(intent_draft.get("intents"))


def _workflow_items(candidate: dict[str, Any]) -> list[dict[str, Any]]:
    workflow_draft = candidate.get("workflowDraft")
    if not isinstance(workflow_draft, dict):
        return []
    return _dict_items(workflow_draft.get("workflows"))


def _policy_items(candidate: dict[str, Any]) -> list[dict[str, Any]]:
    workflow_draft = candidate.get("workflowDraft")
    if not isinstance(workflow_draft, dict):
        return []
    return _dict_items(workflow_draft.get("policies"))


def _risk_items(candidate: dict[str, Any]) -> list[dict[str, Any]]:
    workflow_draft = candidate.get("workflowDraft")
    if not isinstance(workflow_draft, dict):
        return []
    return _dict_items(workflow_draft.get("risks"))


def _dict_items(value: object) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [cast(dict[str, Any], item) for item in value if isinstance(item, dict)]


def _mapping_rate(intents: list[dict[str, Any]], workflows: list[dict[str, Any]]) -> float:
    if not intents or not workflows:
        return 0.0
    intent_codes = {item.get("intentCode") for item in intents if isinstance(item.get("intentCode"), str)}
    if not intent_codes:
        return 0.0
    mapped_workflows = sum(1 for workflow in workflows if workflow.get("intentCode") in intent_codes)
    return mapped_workflows / len(workflows)


def _graph_validity(workflows: list[dict[str, Any]]) -> str:
    for workflow in workflows:
        graph = _parse_graph(workflow.get("graphJson"))
        if graph is None:
            return "failed"
        nodes, edges = _graph_nodes_and_edges(graph)
        if nodes is None or edges is None:
            return "failed"
        if not _has_terminal_node(nodes):
            return "failed"
        if not _edges_reference_existing_nodes(nodes, edges):
            return "failed"
    return "passed"


def _parse_graph(graph_raw: object) -> dict[str, Any] | None:
    if not isinstance(graph_raw, str):
        return None
    try:
        graph = json.loads(graph_raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(graph, dict):
        return None
    return cast(dict[str, Any], graph)


def _graph_nodes_and_edges(graph: dict[str, Any]) -> tuple[list[object] | None, list[object] | None]:
    nodes = graph.get("nodes")
    edges = graph.get("edges")
    if not isinstance(nodes, list) or not isinstance(edges, list):
        return None, None
    return nodes, edges


def _has_terminal_node(nodes: list[object]) -> bool:
    return any(isinstance(node, dict) and node.get("type") == "TERMINAL" for node in nodes)


def _edges_reference_existing_nodes(nodes: list[object], edges: list[object]) -> bool:
    node_ids = {node.get("id") for node in nodes if isinstance(node, dict)}
    return all(isinstance(edge, dict) and edge.get("from") in node_ids and edge.get("to") in node_ids for edge in edges)


def _evidence_coverage(items: list[dict[str, Any]]) -> float:
    grounded_items = [item for item in items if not _needs_review(item)]
    if not grounded_items:
        return 1.0
    supported = sum(1 for item in grounded_items if _has_evidence(item))
    return supported / len(grounded_items)


def _has_evidence(item: dict[str, Any]) -> bool:
    evidence = item.get("evidenceJson") or item.get("evidenceRefs")
    if isinstance(evidence, list):
        return _evidence_has_content(evidence)
    if not isinstance(evidence, str) or not evidence.strip():
        return False
    try:
        parsed = json.loads(evidence)
    except json.JSONDecodeError:
        return False
    return _evidence_has_content(parsed)


def _evidence_has_content(value: object) -> bool:
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return True
    if isinstance(value, list):
        return any(_evidence_has_content(item) for item in value)
    if isinstance(value, dict):
        return any(_evidence_has_content(item) for item in value.values())
    return False


def _needs_review(item: dict[str, Any]) -> bool:
    status = str(item.get("reviewStatus") or item.get("status") or "").lower()
    return status == "needs_review"


def _pii_redaction_failed(candidate: dict[str, Any]) -> bool:
    summary = candidate.get("preprocessingSummary")
    return isinstance(summary, dict) and summary.get("piiRedactionFailed") is True


def _has_auto_confirmed_unsupported_policy_or_risk(items: list[dict[str, Any]]) -> bool:
    for item in items:
        if _has_evidence(item):
            continue
        status = str(item.get("reviewStatus") or item.get("status") or "").lower()
        if status in {"approved", "auto_confirmed", "confirmed"}:
            return True
    return False


def _llm_schema_validity(candidate: dict[str, Any]) -> float:
    summary = candidate.get("llmSummary")
    if not isinstance(summary, dict):
        return 1.0
    valid = summary.get("schemaValidCount")
    total = summary.get("schemaTotalCount")
    if isinstance(valid, int) and isinstance(total, int) and total > 0:
        return valid / total
    failed = summary.get("schemaFailureCount")
    if isinstance(failed, int) and failed > 0:
        return 0.0
    return 1.0


def _metric(candidate: dict[str, Any], key: str) -> float | None:
    value = _metric_value(candidate.get("evaluationInputs"), key)
    if value is None:
        value = _metric_value(candidate.get("evaluationSummary"), key)
    if value is None:
        return None
    return value


def _metric_value(payload: object, key: str) -> float | None:
    if not isinstance(payload, dict):
        return None
    value = payload.get(key)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    return None
