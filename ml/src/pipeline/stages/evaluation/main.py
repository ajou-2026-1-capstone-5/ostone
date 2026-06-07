from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, cast

from pipeline.common.artifacts import ensure_stage_directory, write_stage_manifest
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.exceptions import PipelineConfigurationError, PipelineStageError
from pipeline.stages.preprocessing.io import read_stage_context

from .benchmarks import (
    _benchmark_suite_summary,
    _coerce_benchmark_suite,
    _parse_benchmark_suite,
    _parse_pairwise_benchmark,  # noqa: F401
)
from .evidence import (
    _evidence_coverage,
    _evidence_sufficiency_summary,
    _has_auto_confirmed_unsupported_policy_or_risk,
    _has_evidence,  # noqa: F401
    _llm_schema_validity,
    _pii_redaction_failed,
)
from .gates import _apply_tiered_label_gate, _release_tier
from .graph_validation import _graph_validation_errors, _graph_validity  # noqa: F401
from .metrics import (
    _bool_metric,
    _intent_items,
    _mapping_rate,
    _metric,
    _policy_items,
    _risk_items,
    _slot_items,
    _workflow_items,
)
from .thresholds import (
    BENCHMARK_BOUNDARY_RECALL_REVIEW_THRESHOLD,
    BENCHMARK_CANNOT_LINK_VIOLATION_THRESHOLD,
    BENCHMARK_LABEL_JOINT_ACCURACY_REVIEW_THRESHOLD,
    BENCHMARK_MUST_LINK_RECALL_REVIEW_THRESHOLD,
    BENCHMARK_WORKFLOW_EVENT_RECALL_REVIEW_THRESHOLD,
    CLUSTER_DISTINCTIVENESS_THRESHOLD,
    CLUSTER_STABILITY_THRESHOLD,
    DEFAULT_DEV_EVIDENCE_JSON,
    EVIDENCE_COVERAGE_THRESHOLD,
    EVIDENCE_SUFFICIENCY_THRESHOLD,
    LABEL_FIDELITY_THRESHOLD,
    LABEL_MEMBER_EVIDENCE_COVERAGE_BLOCK_THRESHOLD,
    LABEL_MEMBER_EVIDENCE_COVERAGE_REVIEW_THRESHOLD,
    LABEL_OBJECT_ACTION_JOINT_COVERAGE_BLOCK_THRESHOLD,
    LABEL_OBJECT_ACTION_JOINT_COVERAGE_REVIEW_THRESHOLD,
    LLM_SCHEMA_VALIDITY_THRESHOLD,
    MAPPING_RATE_THRESHOLD,
    OUTLIER_RATE_THRESHOLD,
    POLICY_COVERAGE_THRESHOLD,
    POLICY_NODE_COVERAGE_THRESHOLD,
    REQUIRED_NUMERIC_METRICS,
    RISK_COVERAGE_THRESHOLD,
    RISK_NODE_COVERAGE_THRESHOLD,
    ROUTE_CONDITION_COVERAGE_THRESHOLD,
    SAME_INTENT_OVERMERGE_RISK_BLOCK_THRESHOLD,
    SAME_INTENT_OVERMERGE_RISK_REVIEW_THRESHOLD,
    SLOT_EVIDENCE_COVERAGE_THRESHOLD,
    WORKFLOW_PATH_SUPPORT_THRESHOLD,
    WORKFLOW_PRECISION_BLOCK_THRESHOLD,
    WORKFLOW_PRECISION_REVIEW_THRESHOLD,
    WORKFLOW_REPLAY_FITNESS_BLOCK_THRESHOLD,
    WORKFLOW_REPLAY_FITNESS_REVIEW_THRESHOLD,
    WORKFLOW_SEPARABILITY_THRESHOLD,
    WORKFLOW_SPECIFICITY_BLOCK_THRESHOLD,
    WORKFLOW_SPECIFICITY_REVIEW_THRESHOLD,
)


def run(upstream_manifest_path: str | None = None) -> dict[str, object]:
    if upstream_manifest_path is None:
        raise PipelineConfigurationError("evaluation stage requires an upstream manifest path.")
    runtime_config = PipelineRuntimeConfig.from_env()
    stage_context = read_stage_context(upstream_manifest_path, stage_name="evaluation")
    stage_dir = ensure_stage_directory(stage_context, runtime_config)
    candidate = _load_or_create_candidate(upstream_manifest_path)
    benchmark = _load_evaluation_benchmark(upstream_manifest_path)
    candidate["evaluationSummary"] = _evaluate_candidate(candidate, benchmark=benchmark)
    replay_lift_summary = _replay_lift_summary(upstream_manifest_path, candidate)
    replay_report_path: Path | None = None
    if replay_lift_summary is not None:
        candidate["replayLiftSummary"] = replay_lift_summary
        evaluation_summary = candidate.get("evaluationSummary")
        if isinstance(evaluation_summary, dict):
            evaluation_summary["replayLiftSummary"] = replay_lift_summary
        replay_report_path = stage_dir / "replay_lift_summary.json"
        replay_report_path.write_text(json.dumps(replay_lift_summary, indent=2, ensure_ascii=False), encoding="utf-8")

    candidate_path = stage_dir / "publish_candidate_input.json"
    candidate_path.write_text(json.dumps(candidate, indent=2, ensure_ascii=False), encoding="utf-8")
    manifest_payload: dict[str, object] = {
        "upstream_manifest_path": upstream_manifest_path,
        "candidateArtifactPath": str(candidate_path.resolve()),
        "evaluation_summary": candidate.get("evaluationSummary"),
        "metrics": candidate.get("evaluationSummary"),
    }
    if replay_report_path is not None:
        manifest_payload["replayReportPath"] = replay_report_path.name
    manifest_path = write_stage_manifest(stage_context, runtime_config, manifest_payload)
    result: dict[str, object] = {
        "candidateArtifactPath": str(candidate_path.resolve()),
        "evaluation_summary": candidate.get("evaluationSummary"),
        "artifact_manifest_path": str(manifest_path.resolve()),
    }
    if replay_report_path is not None:
        result["replayReportPath"] = replay_report_path.name
        result["replay_lift_summary"] = replay_lift_summary
    return result


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


def _load_evaluation_benchmark(upstream_manifest_path: str) -> dict[str, Any] | None:
    path = _evaluation_benchmark_path(upstream_manifest_path)
    if path is None:
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise PipelineStageError(f"Failed to read evaluation benchmark: {path}") from exc
    except json.JSONDecodeError as exc:
        raise PipelineStageError(f"Invalid evaluation benchmark JSON: {path}") from exc
    return _parse_benchmark_suite(payload, path)


def _evaluation_benchmark_path(upstream_manifest_path: str) -> Path | None:
    env_value = os.getenv("PIPELINE_EVALUATION_BENCHMARK_PATH", "").strip()
    if env_value:
        return Path(env_value)
    manifest_path = Path(upstream_manifest_path)
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(manifest, dict):
        return None
    payload = manifest.get("payload")
    path_value = _payload_str(payload, "evaluationBenchmarkPath") or _payload_str(payload, "evaluation_benchmark_path")
    return _resolve_path(manifest_path, path_value) if path_value else None


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
        "evaluationInputs": {
            "outlierRate": 0.0,
            "workflowSeparability": 1.0,
            "slotEvidenceCoverage": 1.0,
            "policyCoverage": 1.0,
            "riskCoverage": 1.0,
            "semanticQualityFinal": True,
            "semanticClusterCohesion": 1.0,
            "semanticSeparationMargin": 1.0,
            "clusterDistinctiveness": 1.0,
            "positiveMarginRate": 1.0,
            "clusterStability": 1.0,
            "labelFidelity": 1.0,
            "labelMemberEvidenceCoverage": 1.0,
            "labelObjectCoverage": 1.0,
            "labelActionCoverage": 1.0,
            "labelObjectActionJointCoverage": 1.0,
            "workflowPathSupport": 1.0,
            "workflowReplayFitness": 1.0,
            "workflowPrecision": 1.0,
            "workflowSpecificity": 1.0,
            "sameIntentOvermergeRisk": 0.0,
        },
    }


_REPLAY_LIFT_METRICS: tuple[tuple[str, str, str], ...] = (
    ("reviewRequiredRate", "reviewRequiredRate", "lower"),
    ("highConfidenceWorkflowCount", "highConfidenceWorkflowCount", "higher"),
    ("duplicateLabelRate", "duplicateLabelRate", "lower"),
    ("entrypointSemanticSeparationMargin", "entrypointSemanticSeparationMargin", "higher"),
    ("positiveMarginRate", "positiveMarginRate", "higher"),
    ("sameIntentGraph.conflictPairRate", "sameIntentGraphConflictPairRate", "lower"),
)
_FLOAT_ZERO_EPSILON = 1e-12


def _replay_lift_summary(upstream_manifest_path: str, candidate: dict[str, Any]) -> dict[str, Any] | None:
    source_manifest_path = _source_replay_manifest_path(Path(upstream_manifest_path))
    if source_manifest_path is None:
        return None
    source_candidate = _load_source_candidate(source_manifest_path)
    if source_candidate is None:
        return {
            "schemaVersion": "feedback-replay-lift.v1",
            "available": False,
            "sourceManifestPath": str(source_manifest_path),
            "reason": "source_candidate_not_found",
            "metricComparisons": {},
            "qualityDegraded": False,
        }

    comparisons = {
        metric_name: comparison
        for metric_name, metric_key, direction in _REPLAY_LIFT_METRICS
        if (
            comparison := _metric_comparison(
                before=_candidate_metric(source_candidate, metric_key),
                after=_candidate_metric(candidate, metric_key),
                direction=direction,
            )
        )
        is not None
    }
    recurrence_rate = _review_task_recurrence_rate(source_candidate, candidate)
    comparisons["reviewTaskRecurrenceRate"] = {
        "before": 0.0,
        "after": recurrence_rate,
        "delta": recurrence_rate,
        "direction": "lower",
        "improved": recurrence_rate < _FLOAT_ZERO_EPSILON,
        "degraded": recurrence_rate >= _FLOAT_ZERO_EPSILON,
    }
    degraded_metrics = [
        metric_name for metric_name, comparison in comparisons.items() if comparison.get("degraded") is True
    ]
    return {
        "schemaVersion": "feedback-replay-lift.v1",
        "available": True,
        "sourceManifestPath": str(source_manifest_path),
        "metricComparisons": comparisons,
        "qualityDegraded": bool(degraded_metrics),
        "degradedMetrics": degraded_metrics,
    }


def _source_replay_manifest_path(upstream_manifest_path: Path) -> Path | None:
    current_manifest_path = upstream_manifest_path
    current_run_dir = upstream_manifest_path.parent.parent
    seen: set[Path] = set()
    for _ in range(12):
        resolved_current = current_manifest_path.resolve()
        if resolved_current in seen or not current_manifest_path.exists():
            return None
        seen.add(resolved_current)
        manifest = _read_json_object(current_manifest_path)
        payload = manifest.get("payload")
        upstream_value = _payload_str(payload, "upstream_manifest_path")
        if not upstream_value:
            return None
        next_manifest_path = Path(upstream_value).expanduser()
        if not next_manifest_path.is_absolute():
            next_manifest_path = current_manifest_path.parent / next_manifest_path
        next_manifest_path = next_manifest_path.resolve()
        if next_manifest_path.name == "manifest.json" and next_manifest_path.parent.parent != current_run_dir:
            return next_manifest_path
        current_manifest_path = next_manifest_path
    return None


def _load_source_candidate(source_manifest_path: Path) -> dict[str, Any] | None:
    source_run_dir = source_manifest_path.parent.parent
    for candidate_path in (
        source_run_dir / "evaluation" / "publish_candidate_input.json",
        source_run_dir / "draft_generation" / "candidate.json",
    ):
        if not candidate_path.exists():
            continue
        candidate = _read_json_object(candidate_path)
        return candidate
    return None


def _read_json_object(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


def _candidate_metric(candidate: dict[str, Any], key: str) -> float | None:
    value = _metric(candidate, key)
    if value is not None:
        return value
    if key == "sameIntentGraphConflictPairRate":
        return _nested_numeric(candidate.get("evaluationInputs"), ("sameIntentGraph", "conflictPairRate"))
    return None


def _nested_numeric(payload: object, path: tuple[str, ...]) -> float | None:
    current = payload
    for key in path:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    if isinstance(current, (int, float)) and not isinstance(current, bool):
        return float(current)
    return None


def _metric_comparison(before: float | None, after: float | None, direction: str) -> dict[str, object] | None:
    if before is None or after is None:
        return None
    delta = after - before
    improved = delta > 0 if direction == "higher" else delta < 0
    degraded = delta < 0 if direction == "higher" else delta > 0
    return {
        "before": before,
        "after": after,
        "delta": delta,
        "direction": direction,
        "improved": improved,
        "degraded": degraded,
    }


def _review_task_recurrence_rate(before_candidate: dict[str, Any], after_candidate: dict[str, Any]) -> float:
    before_keys = _review_task_keys(before_candidate)
    after_keys = _review_task_keys(after_candidate)
    if not before_keys:
        return 0.0
    return len(before_keys & after_keys) / len(before_keys)


def _review_task_keys(candidate: dict[str, Any]) -> set[str]:
    summary = candidate.get("evaluationSummary")
    if not isinstance(summary, dict):
        summary = {}
    keys = {f"block:{item}" for item in _string_list(summary.get("blockReasons"))}
    keys.update(f"quality:{item}" for item in _string_list(summary.get("qualityReviewReasons")))
    return keys


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for raw in value if (item := str(raw).strip())]


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


def _evaluate_candidate(
    candidate: dict[str, Any],
    benchmark: dict[str, Any] | list[dict[str, object]] | None = None,
) -> dict[str, Any]:
    workflows = _workflow_items(candidate)
    intents = _intent_items(candidate)
    slots = _slot_items(candidate)
    policies = _policy_items(candidate)
    risks = _risk_items(candidate)
    draft_entities = intents + workflows + slots + policies + risks

    block_reasons: list[str] = []
    quality_review_reasons: list[str] = []
    graph_validation_errors = _graph_validation_errors(workflows)
    graph_validity = "passed" if not graph_validation_errors else "failed"
    if graph_validity != "passed":
        block_reasons.append("graph_validity_failed")

    evidence_coverage = _evidence_coverage(draft_entities)
    if evidence_coverage < EVIDENCE_COVERAGE_THRESHOLD:
        block_reasons.append("evidence_coverage_below_threshold")
    evidence_sufficiency = _evidence_sufficiency_summary(intents, workflows, slots, policies, risks)
    if evidence_sufficiency["score"] < EVIDENCE_SUFFICIENCY_THRESHOLD:
        block_reasons.append("evidence_sufficiency_below_threshold")

    if _pii_redaction_failed(candidate):
        block_reasons.append("pii_redaction_failed")

    if _has_auto_confirmed_unsupported_policy_or_risk(policies + risks):
        block_reasons.append("unsupported_policy_or_risk")

    llm_schema_validity = _llm_schema_validity(candidate)
    if llm_schema_validity < LLM_SCHEMA_VALIDITY_THRESHOLD:
        block_reasons.append("llm_schema_validation_failed")

    mapping_rate = _mapping_rate(intents, workflows)
    outlier_rate = _metric(candidate, "outlierRate")
    raw_outlier_rate = _metric(candidate, "rawOutlierRate")
    workflow_separability = _metric(candidate, "workflowSeparability")
    slot_evidence_coverage = _metric(candidate, "slotEvidenceCoverage")
    policy_coverage = _metric(candidate, "policyCoverage")
    risk_coverage = _metric(candidate, "riskCoverage")
    semantic_quality_final = _bool_metric(candidate, "semanticQualityFinal")
    semantic_cluster_cohesion = _metric(candidate, "semanticClusterCohesion")
    semantic_separation_margin = _metric(candidate, "semanticSeparationMargin")
    cluster_distinctiveness = _metric(candidate, "clusterDistinctiveness")
    cluster_stability = _metric(candidate, "clusterStability")
    label_fidelity = _metric(candidate, "labelFidelity")
    label_member_evidence_coverage = _metric(candidate, "labelMemberEvidenceCoverage")
    label_object_coverage = _metric(candidate, "labelObjectCoverage")
    label_action_coverage = _metric(candidate, "labelActionCoverage")
    label_object_action_joint_coverage = _metric(candidate, "labelObjectActionJointCoverage")
    auto_candidate_label_count = _metric(candidate, "autoCandidateLabelCount")
    auto_candidate_label_fidelity = _metric(candidate, "autoCandidateLabelFidelity")
    auto_candidate_label_member_evidence_coverage = _metric(candidate, "autoCandidateLabelMemberEvidenceCoverage")
    auto_candidate_label_object_action_joint_coverage = _metric(
        candidate,
        "autoCandidateLabelObjectActionJointCoverage",
    )
    review_required_label_count = _metric(candidate, "reviewRequiredLabelCount")
    review_required_label_fidelity = _metric(candidate, "reviewRequiredLabelFidelity")
    review_required_label_member_evidence_coverage = _metric(candidate, "reviewRequiredLabelMemberEvidenceCoverage")
    review_required_label_object_action_joint_coverage = _metric(
        candidate,
        "reviewRequiredLabelObjectActionJointCoverage",
    )
    workflow_path_support = _metric(candidate, "workflowPathSupport")
    workflow_replay_fitness = _metric(candidate, "workflowReplayFitness")
    workflow_precision = _metric(candidate, "workflowPrecision")
    workflow_specificity = _metric(candidate, "workflowSpecificity")
    same_intent_overmerge_risk = _metric(candidate, "sameIntentOvermergeRisk")
    workflow_confidence_avg = _metric(candidate, "workflowConfidenceAvg")
    workflow_confidence_min = _metric(candidate, "workflowConfidenceMin")
    review_required_rate = _metric(candidate, "reviewRequiredRate")
    duplicate_label_rate = _metric(candidate, "duplicateLabelRate")
    parent_intent_count = _metric(candidate, "parentIntentCount")
    leaf_intent_count = _metric(candidate, "leafIntentCount")
    workflow_variant_intent_count = _metric(candidate, "workflowVariantIntentCount")
    variants_per_parent_intent_avg = _metric(candidate, "variantsPerParentIntentAvg")
    variants_per_parent_intent_max = _metric(candidate, "variantsPerParentIntentMax")
    single_variant_intent_rate = _metric(candidate, "singleVariantIntentRate")
    max_workflow_coverage = _metric(candidate, "maxWorkflowCoverage")
    effective_workflow_count = _metric(candidate, "effectiveWorkflowCount")
    entrypoint_semantic_coverage = _metric(candidate, "entrypointSemanticCoverage")
    entrypoint_distinctiveness = _metric(candidate, "entrypointDistinctiveness")
    route_condition_coverage = _metric(candidate, "routeConditionCoverage")
    policy_node_coverage = _metric(candidate, "policyNodeCoverage")
    risk_node_coverage = _metric(candidate, "riskNodeCoverage")
    for metric_name in REQUIRED_NUMERIC_METRICS:
        if _metric(candidate, metric_name) is None:
            block_reasons.append(f"missing_metric:{metric_name}")
    if semantic_quality_final is None:
        block_reasons.append("missing_metric:semanticQualityFinal")
    if mapping_rate < MAPPING_RATE_THRESHOLD:
        block_reasons.append("mapping_rate_below_threshold")
    if outlier_rate is not None and outlier_rate > OUTLIER_RATE_THRESHOLD:
        block_reasons.append("outlier_rate_above_threshold")
    if workflow_separability is not None and workflow_separability < WORKFLOW_SEPARABILITY_THRESHOLD:
        block_reasons.append("workflow_separability_below_threshold")
    if slot_evidence_coverage is not None and slot_evidence_coverage < SLOT_EVIDENCE_COVERAGE_THRESHOLD:
        block_reasons.append("slot_evidence_coverage_below_threshold")
    if policy_coverage is not None and policy_coverage < POLICY_COVERAGE_THRESHOLD:
        block_reasons.append("policy_coverage_below_threshold")
    if risk_coverage is not None and risk_coverage < RISK_COVERAGE_THRESHOLD:
        block_reasons.append("risk_coverage_below_threshold")
    if semantic_quality_final is False:
        block_reasons.append("semantic_quality_not_final")
    if cluster_stability is not None and cluster_stability < CLUSTER_STABILITY_THRESHOLD:
        quality_review_reasons.append("cluster_stability_below_threshold")
    if cluster_distinctiveness is not None and cluster_distinctiveness < CLUSTER_DISTINCTIVENESS_THRESHOLD:
        quality_review_reasons.append("cluster_distinctiveness_below_threshold")
    if label_fidelity is not None and label_fidelity < LABEL_FIDELITY_THRESHOLD:
        quality_review_reasons.append("label_fidelity_below_threshold")
    if workflow_path_support is not None and workflow_path_support < WORKFLOW_PATH_SUPPORT_THRESHOLD:
        block_reasons.append("workflow_path_support_below_threshold")
    _apply_tiered_label_gate(
        metric_value=label_member_evidence_coverage,
        auto_metric_value=auto_candidate_label_member_evidence_coverage,
        auto_count=auto_candidate_label_count,
        review_threshold=LABEL_MEMBER_EVIDENCE_COVERAGE_REVIEW_THRESHOLD,
        block_threshold=LABEL_MEMBER_EVIDENCE_COVERAGE_BLOCK_THRESHOLD,
        block_reason="label_member_evidence_coverage_below_block_threshold",
        review_reason="label_member_evidence_coverage_below_threshold",
        review_only_block_reason="review_required_label_member_evidence_coverage_below_block_threshold",
        auto_block_reason="auto_candidate_label_member_evidence_coverage_below_block_threshold",
        block_reasons=block_reasons,
        quality_review_reasons=quality_review_reasons,
    )
    _apply_tiered_label_gate(
        metric_value=label_object_action_joint_coverage,
        auto_metric_value=auto_candidate_label_object_action_joint_coverage,
        auto_count=auto_candidate_label_count,
        review_threshold=LABEL_OBJECT_ACTION_JOINT_COVERAGE_REVIEW_THRESHOLD,
        block_threshold=LABEL_OBJECT_ACTION_JOINT_COVERAGE_BLOCK_THRESHOLD,
        block_reason="label_object_action_joint_coverage_below_block_threshold",
        review_reason="label_object_action_joint_coverage_below_threshold",
        review_only_block_reason="review_required_label_object_action_joint_coverage_below_block_threshold",
        auto_block_reason="auto_candidate_label_object_action_joint_coverage_below_block_threshold",
        block_reasons=block_reasons,
        quality_review_reasons=quality_review_reasons,
    )
    if workflow_replay_fitness is not None and workflow_replay_fitness < WORKFLOW_REPLAY_FITNESS_BLOCK_THRESHOLD:
        block_reasons.append("workflow_replay_fitness_below_block_threshold")
    elif workflow_replay_fitness is not None and workflow_replay_fitness < WORKFLOW_REPLAY_FITNESS_REVIEW_THRESHOLD:
        quality_review_reasons.append("workflow_replay_fitness_below_threshold")
    if workflow_precision is not None and workflow_precision < WORKFLOW_PRECISION_BLOCK_THRESHOLD:
        block_reasons.append("workflow_precision_below_block_threshold")
    elif workflow_precision is not None and workflow_precision < WORKFLOW_PRECISION_REVIEW_THRESHOLD:
        quality_review_reasons.append("workflow_precision_below_threshold")
    if workflow_specificity is not None and workflow_specificity < WORKFLOW_SPECIFICITY_BLOCK_THRESHOLD:
        block_reasons.append("workflow_specificity_below_block_threshold")
    elif workflow_specificity is not None and workflow_specificity < WORKFLOW_SPECIFICITY_REVIEW_THRESHOLD:
        quality_review_reasons.append("workflow_specificity_below_threshold")
    if (
        same_intent_overmerge_risk is not None
        and same_intent_overmerge_risk > SAME_INTENT_OVERMERGE_RISK_BLOCK_THRESHOLD
    ):
        block_reasons.append("same_intent_overmerge_risk_above_block_threshold")
    elif (
        same_intent_overmerge_risk is not None
        and same_intent_overmerge_risk > SAME_INTENT_OVERMERGE_RISK_REVIEW_THRESHOLD
    ):
        quality_review_reasons.append("same_intent_overmerge_risk_above_threshold")
    if route_condition_coverage is not None and route_condition_coverage < ROUTE_CONDITION_COVERAGE_THRESHOLD:
        block_reasons.append("route_condition_coverage_below_threshold")
    if policy_node_coverage is not None and policy_node_coverage < POLICY_NODE_COVERAGE_THRESHOLD:
        block_reasons.append("policy_node_coverage_below_threshold")
    if risk_node_coverage is not None and risk_node_coverage < RISK_NODE_COVERAGE_THRESHOLD:
        block_reasons.append("risk_node_coverage_below_threshold")
    benchmark_suite = _coerce_benchmark_suite(benchmark)
    benchmark_summary = _benchmark_suite_summary(intents, workflows, benchmark_suite)
    pairwise_benchmark_summary = benchmark_summary["pairwise"]
    boundary_benchmark_summary = benchmark_summary["boundary"]
    label_benchmark_summary = benchmark_summary["label"]
    workflow_benchmark_summary = benchmark_summary["workflow"]
    if pairwise_benchmark_summary["enabled"] is True:
        if pairwise_benchmark_summary["cannotLinkViolationRate"] > BENCHMARK_CANNOT_LINK_VIOLATION_THRESHOLD:
            block_reasons.append("benchmark_cannot_link_violation")
        if pairwise_benchmark_summary["mustLinkRecall"] < BENCHMARK_MUST_LINK_RECALL_REVIEW_THRESHOLD:
            quality_review_reasons.append("benchmark_must_link_recall_below_threshold")
    if (
        boundary_benchmark_summary["enabled"] is True
        and boundary_benchmark_summary["boundaryRecall"] < BENCHMARK_BOUNDARY_RECALL_REVIEW_THRESHOLD
    ):
        quality_review_reasons.append("benchmark_boundary_recall_below_threshold")
    if label_benchmark_summary["enabled"] is True:
        if label_benchmark_summary["forbiddenTermViolationRate"] > 0.0:
            block_reasons.append("benchmark_label_forbidden_term_violation")
        if label_benchmark_summary["objectActionJointAccuracy"] < BENCHMARK_LABEL_JOINT_ACCURACY_REVIEW_THRESHOLD:
            quality_review_reasons.append("benchmark_label_object_action_joint_accuracy_below_threshold")
    if (
        workflow_benchmark_summary["enabled"] is True
        and workflow_benchmark_summary["eventRecall"] < BENCHMARK_WORKFLOW_EVENT_RECALL_REVIEW_THRESHOLD
    ):
        quality_review_reasons.append("benchmark_workflow_event_recall_below_threshold")
    passed = not block_reasons
    release_tier = _release_tier(
        block_reasons=block_reasons,
        cluster_stability=cluster_stability,
        label_fidelity=label_fidelity,
        workflow_path_support=workflow_path_support,
        quality_review_reasons=quality_review_reasons,
        review_required_rate=review_required_rate,
        duplicate_label_rate=duplicate_label_rate,
        workflow_confidence_avg=workflow_confidence_avg,
        workflow_confidence_min=workflow_confidence_min,
    )
    return {
        "passed": passed,
        "releaseTier": release_tier,
        "mappingRate": mapping_rate,
        "outlierRate": outlier_rate,
        "rawOutlierRate": raw_outlier_rate,
        "representedOutlierCoverage": _metric(candidate, "representedOutlierCoverage"),
        "promotedNovelCandidateCount": _metric(candidate, "promotedNovelCandidateCount"),
        "promotedNovelMemberCount": _metric(candidate, "promotedNovelMemberCount"),
        "unrepresentedOutlierMemberCount": _metric(candidate, "unrepresentedOutlierMemberCount"),
        "workflowSeparability": workflow_separability,
        "evidenceCoverage": evidence_coverage,
        "evidenceSufficiency": evidence_sufficiency["score"],
        "evidenceSufficiencySupportedFieldCount": evidence_sufficiency["supportedFieldCount"],
        "evidenceSufficiencyTotalFieldCount": evidence_sufficiency["totalFieldCount"],
        "evidenceSufficiencyUnsupportedFields": evidence_sufficiency["unsupportedFields"],
        "slotEvidenceCoverage": slot_evidence_coverage,
        "policyCoverage": policy_coverage,
        "riskCoverage": risk_coverage,
        "semanticQualityFinal": semantic_quality_final,
        "semanticClusterCohesion": semantic_cluster_cohesion,
        "semanticSeparationMargin": semantic_separation_margin,
        "clusterDistinctiveness": cluster_distinctiveness,
        "positiveMarginRate": _metric(candidate, "positiveMarginRate"),
        "semanticSilhouetteProxy": _metric(candidate, "semanticSilhouetteProxy"),
        "entrypointSemanticCoverage": entrypoint_semantic_coverage,
        "entrypointSemanticCohesion": _metric(candidate, "entrypointSemanticCohesion"),
        "entrypointSemanticSeparationMargin": _metric(candidate, "entrypointSemanticSeparationMargin"),
        "entrypointDistinctiveness": entrypoint_distinctiveness,
        "entrypointPositiveMarginRate": _metric(candidate, "entrypointPositiveMarginRate"),
        "clusterStability": cluster_stability,
        "labelFidelity": label_fidelity,
        "reviewCandidateLabelFidelity": _metric(candidate, "reviewCandidateLabelFidelity"),
        "labelMemberEvidenceCoverage": label_member_evidence_coverage,
        "labelObjectCoverage": label_object_coverage,
        "labelActionCoverage": label_action_coverage,
        "labelObjectActionJointCoverage": label_object_action_joint_coverage,
        "autoCandidateLabelCount": auto_candidate_label_count,
        "autoCandidateLabelFidelity": auto_candidate_label_fidelity,
        "autoCandidateLabelMemberEvidenceCoverage": auto_candidate_label_member_evidence_coverage,
        "autoCandidateLabelObjectActionJointCoverage": auto_candidate_label_object_action_joint_coverage,
        "reviewRequiredLabelCount": review_required_label_count,
        "reviewRequiredLabelFidelity": review_required_label_fidelity,
        "reviewRequiredLabelMemberEvidenceCoverage": review_required_label_member_evidence_coverage,
        "reviewRequiredLabelObjectActionJointCoverage": review_required_label_object_action_joint_coverage,
        "workflowPathSupport": workflow_path_support,
        "workflowReplayFitness": workflow_replay_fitness,
        "workflowPrecision": workflow_precision,
        "workflowSpecificity": workflow_specificity,
        "sameIntentOvermergeRisk": same_intent_overmerge_risk,
        "routeConditionCoverage": route_condition_coverage,
        "specificNodeRatio": _metric(candidate, "specificNodeRatio"),
        "workflowSpecificNodeRate": _metric(candidate, "workflowSpecificNodeRate"),
        "slotNodeCoverage": _metric(candidate, "slotNodeCoverage"),
        "policyNodeCoverage": policy_node_coverage,
        "riskNodeCoverage": risk_node_coverage,
        "lowSupportWorkflowRate": _metric(candidate, "lowSupportWorkflowRate"),
        "reviewOnlyWorkflowCount": _metric(candidate, "reviewOnlyWorkflowCount"),
        "workflowConfidenceAvg": workflow_confidence_avg,
        "workflowConfidenceMin": workflow_confidence_min,
        "highConfidenceWorkflowCount": _metric(candidate, "highConfidenceWorkflowCount"),
        "sampleReviewWorkflowCount": _metric(candidate, "sampleReviewWorkflowCount"),
        "reviewRequiredWorkflowCount": _metric(candidate, "reviewRequiredWorkflowCount"),
        "reviewRequiredRate": review_required_rate,
        "lowConfidenceWorkflowCount": _metric(candidate, "lowConfidenceWorkflowCount"),
        "duplicateLabelRate": duplicate_label_rate,
        "reviewCandidateDuplicateLabelRate": _metric(candidate, "reviewCandidateDuplicateLabelRate"),
        "parentIntentCount": parent_intent_count,
        "leafIntentCount": leaf_intent_count,
        "workflowVariantIntentCount": workflow_variant_intent_count,
        "variantsPerParentIntentAvg": variants_per_parent_intent_avg,
        "variantsPerParentIntentMax": variants_per_parent_intent_max,
        "singleVariantIntentRate": single_variant_intent_rate,
        "maxWorkflowCoverage": max_workflow_coverage,
        "effectiveWorkflowCount": effective_workflow_count,
        "avgSlotsPerIntent": _metric(candidate, "avgSlotsPerIntent"),
        "avgPoliciesPerIntent": _metric(candidate, "avgPoliciesPerIntent"),
        "avgRisksPerIntent": _metric(candidate, "avgRisksPerIntent"),
        "graphValidity": graph_validity,
        "graphValidationErrors": graph_validation_errors[:20],
        "llmSchemaValidity": llm_schema_validity,
        "llmRepairRate": _metric(candidate, "llmRepairRate"),
        "humanReviewRejectionRate": _metric(candidate, "humanReviewRejectionRate"),
        "benchmarkSuite": benchmark_summary,
        "pairwiseBenchmark": pairwise_benchmark_summary,
        "boundaryBenchmark": boundary_benchmark_summary,
        "labelBenchmark": label_benchmark_summary,
        "workflowBenchmark": workflow_benchmark_summary,
        "benchmarkPairCount": pairwise_benchmark_summary["pairCount"],
        "benchmarkCoverage": pairwise_benchmark_summary["coverage"],
        "benchmarkMustLinkRecall": pairwise_benchmark_summary["mustLinkRecall"],
        "benchmarkCannotLinkViolationRate": pairwise_benchmark_summary["cannotLinkViolationRate"],
        "benchmarkBoundaryCaseCount": boundary_benchmark_summary["caseCount"],
        "benchmarkBoundaryRecall": boundary_benchmark_summary["boundaryRecall"],
        "benchmarkLabelExpectationCount": label_benchmark_summary["expectationCount"],
        "benchmarkLabelObjectActionJointAccuracy": label_benchmark_summary["objectActionJointAccuracy"],
        "benchmarkWorkflowExpectationCount": workflow_benchmark_summary["expectationCount"],
        "benchmarkWorkflowEventRecall": workflow_benchmark_summary["eventRecall"],
        "blockReasons": block_reasons,
        "qualityReviewReasons": quality_review_reasons,
    }
