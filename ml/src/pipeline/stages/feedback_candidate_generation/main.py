from __future__ import annotations

import json
import os
import time
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from pipeline.common.artifacts import ensure_stage_directory, write_stage_manifest
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.exceptions import PipelineConfigurationError, PipelineStageError
from pipeline.stages.feedback_candidate_generation.review_question_enrichment import enrich_review_questions
from pipeline.stages.flow_splitting.constants import CLUSTERS_ARTIFACT, WORKFLOW_ENTRYPOINTS_ARTIFACT
from pipeline.stages.preprocessing.io import read_stage_context

from .selection import (
    CANNOT_LINK_KIND,
    SELECTION_METRICS_ARTIFACT,
    QuestionCandidate,
    SelectionResult,
    collect_candidates,
    select_candidates,
)

ARTIFACT_NAME = "feedback_review_questions.json"
MAX_QUESTIONS = 12
QUESTION_TYPE_INTENT_BOUNDARY = "INTENT_BOUNDARY"
QUESTION_TYPE_WORKFLOW_BOUNDARY = "WORKFLOW_BOUNDARY"
DECISION_SCOPE_INTENT = "intent"
DECISION_SCOPE_WORKFLOW = "workflow"
INTENT_ANSWER_OPTIONS = [
    {
        "value": "must_link",
        "label": "같은 intent로 묶기",
        "decisionScope": DECISION_SCOPE_INTENT,
        "constraintType": "must_link",
    },
    {
        "value": "cannot_link",
        "label": "다른 intent로 분리",
        "decisionScope": DECISION_SCOPE_INTENT,
        "constraintType": "cannot_link",
    },
    {"value": "unsure", "label": "판단 보류", "decisionScope": "none"},
]
WORKFLOW_ANSWER_OPTIONS = [
    {
        "value": "same_workflow",
        "label": "같은 workflow로 합치기",
        "decisionScope": DECISION_SCOPE_WORKFLOW,
    },
    {
        "value": "same_intent_separate_workflow",
        "label": "같은 intent지만 workflow는 분리",
        "decisionScope": DECISION_SCOPE_WORKFLOW,
    },
    {
        "value": "different_intent",
        "label": "다른 intent로 분리",
        "decisionScope": DECISION_SCOPE_INTENT,
        "constraintType": "cannot_link",
    },
    {"value": "unsure", "label": "판단 보류", "decisionScope": "none"},
]


def run(upstream_manifest_path: str | None = None) -> dict[str, object]:
    started_at = time.monotonic()
    runtime_config = PipelineRuntimeConfig.from_env()
    stage_context = read_stage_context(upstream_manifest_path, stage_name="feedback_candidate_generation")
    output_dir = ensure_stage_directory(stage_context, runtime_config)
    flow_dir = _flow_splitting_dir(runtime_config, stage_context)
    clusters_payload = _read_json(flow_dir / CLUSTERS_ARTIFACT)
    entrypoints_payload = _read_json(flow_dir / WORKFLOW_ENTRYPOINTS_ARTIFACT)
    preprocessed_index = _read_preprocessed_index(runtime_config, stage_context)
    questions, selection = _build_questions(
        clusters_payload,
        entrypoints_payload,
        preprocessed_index,
        limit=_question_limit(),
    )
    quality_kpis = _quality_kpis(questions)
    enrichment_summary = enrich_review_questions(questions, runtime_config)
    payload: dict[str, object] = {
        "schemaVersion": "feedback-review-questions.v1",
        "stage": "feedback_candidate_generation",
        "generatedAt": datetime.now(UTC).isoformat(),
        "questionText": "두 상담을 같은 intent로 묶어도 되나요?",
        "answerOptions": INTENT_ANSWER_OPTIONS,
        "questionCount": len(questions),
        "qualityKpis": quality_kpis,
        "questions": questions,
        "enrichmentSummary": enrichment_summary,
        "durationSeconds": round(time.monotonic() - started_at, 4),
    }
    artifact_path = output_dir / ARTIFACT_NAME
    artifact_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    selection_metrics_path = output_dir / SELECTION_METRICS_ARTIFACT
    selection_metrics_path.write_text(
        json.dumps(selection.metrics, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    manifest_path = write_stage_manifest(
        stage_context,
        runtime_config,
        {
            "upstream_manifest_path": upstream_manifest_path,
            "feedbackQuestionsPath": artifact_path.name,
            "reportPath": selection_metrics_path.name,
            "recordCount": len(questions),
            "metrics": {
                "feedbackQuestionCount": len(questions),
                "reviewQuestionEnrichmentEnabled": bool(enrichment_summary.get("enabled")),
                "reviewQuestionEnrichmentAppliedCount": int(enrichment_summary.get("appliedCount", 0)),
                "reviewQuestionEnrichmentFallbackCount": int(enrichment_summary.get("fallbackCount", 0)),
                "reviewQuestionEnrichmentAbstainCount": int(enrichment_summary.get("abstainCount", 0)),
                "reviewQuestionEnrichmentSchemaFailureCount": int(enrichment_summary.get("schemaFailureCount", 0)),
                "reviewQuestionEnrichmentGroundingFailureCount": int(
                    enrichment_summary.get("groundingFailureCount", 0)
                ),
                "qualityKpis": quality_kpis,
                "selection": selection.metrics,
            },
        },
    )
    return {"artifact_manifest_path": str(manifest_path.resolve())}


def _build_questions(
    clusters_payload: dict[str, Any],
    entrypoints_payload: dict[str, Any],
    preprocessed_index: dict[str, dict[str, Any]],
    *,
    limit: int,
) -> tuple[list[dict[str, object]], SelectionResult]:
    entrypoints = [item for item in entrypoints_payload.get("workflowEntryPoints", []) if isinstance(item, dict)]
    clusters = [item for item in clusters_payload.get("clusters", []) if isinstance(item, dict)]
    candidates = collect_candidates(entrypoints, clusters, limit=limit)
    selection = select_candidates(candidates, limit=limit)
    return _questions_from_selection(selection.selected, preprocessed_index), selection


def _questions_from_selection(
    selected: list[QuestionCandidate],
    preprocessed_index: dict[str, dict[str, Any]],
) -> list[dict[str, object]]:
    questions: list[dict[str, object]] = []
    cannot_link_sequence: Counter[str] = Counter()
    must_link_count = 0
    for candidate in selected:
        if candidate.kind == CANNOT_LINK_KIND:
            cannot_link_sequence[candidate.source_cluster_id] += 1
            questions.append(
                _question(
                    question_id=(
                        f"workflow-boundary-{candidate.source_cluster_id}"
                        f"-{cannot_link_sequence[candidate.source_cluster_id]}"
                    ),
                    source_id=candidate.source_id,
                    target_id=candidate.target_id,
                    preprocessed_index=preprocessed_index,
                    question_type=QUESTION_TYPE_WORKFLOW_BOUNDARY,
                    decision_scope=DECISION_SCOPE_WORKFLOW,
                    reason="same_source_cluster_split",
                    priority="LOW" if candidate.is_weak else "HIGH",
                    source_cluster_id=candidate.source_cluster_id,
                )
            )
            continue
        must_link_count += 1
        cluster_key = candidate.cluster_id or candidate.source_cluster_id or str(must_link_count - 1)
        questions.append(
            _question(
                question_id=f"must-link-{cluster_key}-{must_link_count}",
                source_id=candidate.source_id,
                target_id=candidate.target_id,
                preprocessed_index=preprocessed_index,
                question_type=QUESTION_TYPE_INTENT_BOUNDARY,
                decision_scope=DECISION_SCOPE_INTENT,
                reason="low_confidence_cluster_boundary",
                priority="LOW" if candidate.is_weak else "NORMAL",
                source_cluster_id=candidate.source_cluster_id,
            )
        )
    return questions


def _question(
    *,
    question_id: str,
    source_id: str,
    target_id: str,
    preprocessed_index: dict[str, dict[str, Any]],
    question_type: str,
    decision_scope: str,
    reason: str,
    priority: str,
    source_cluster_id: str = "",
) -> dict[str, object]:
    question_text = _question_text(question_type)
    return {
        "questionId": question_id,
        "questionType": question_type,
        "decisionScope": decision_scope,
        "questionText": question_text,
        "answerOptions": _answer_options(question_type),
        "sourceId": source_id,
        "targetId": target_id,
        "sourceClusterId": source_cluster_id,
        "sourceReviewContext": _review_context(source_id, preprocessed_index.get(source_id)),
        "targetReviewContext": _review_context(target_id, preprocessed_index.get(target_id)),
        "sourceSnippet": _snippet(preprocessed_index.get(source_id)),
        "targetSnippet": _snippet(preprocessed_index.get(target_id)),
        "reason": reason,
        "reasonLabel": _reason_label(reason),
        "priority": priority,
    }


def _question_text(question_type: str) -> str:
    if question_type == QUESTION_TYPE_WORKFLOW_BOUNDARY:
        return "같은 intent 안에서 두 상담을 같은 workflow로 합쳐도 되나요?"
    return "두 상담을 같은 intent로 묶어도 되나요?"


def _answer_options(question_type: str) -> list[dict[str, str]]:
    if question_type == QUESTION_TYPE_WORKFLOW_BOUNDARY:
        return WORKFLOW_ANSWER_OPTIONS
    return INTENT_ANSWER_OPTIONS


def _quality_kpis(questions: list[dict[str, object]]) -> dict[str, object]:
    question_count = len(questions)
    type_counts = Counter(
        str(question.get("questionType") or question.get("recommendedConstraintType") or "unknown")
        for question in questions
    )
    constraint_counts = Counter(
        constraint_type
        for question in questions
        if (constraint_type := str(question.get("recommendedConstraintType") or "").strip())
    )
    endpoint_counts = Counter(
        endpoint
        for question in questions
        for endpoint in (str(question.get("sourceId") or ""), str(question.get("targetId") or ""))
        if endpoint
    )
    repeated_endpoint_count = sum(count for count in endpoint_counts.values() if count > 1)
    endpoint_total = sum(endpoint_counts.values())
    source_cluster_counts = Counter(
        source_cluster_id for question in questions if (source_cluster_id := _question_source_cluster_id(question))
    )
    answer_count = 0
    unsure_count = 0
    weak_label_count = 0
    mixed_residual_count = 0
    for question in questions:
        answer = str(question.get("answer") or question.get("selectedAnswer") or "").strip()
        if answer:
            answer_count += 1
            unsure_count += int(answer == "unsure")
        reason = str(question.get("reason") or "")
        if "weak" in reason or "low_confidence" in reason:
            weak_label_count += 1
        if "mixed_residual" in reason or str(question.get("splitReason") or "") == "mixed_residual":
            mixed_residual_count += 1
    must_count = constraint_counts.get("must_link", 0)
    cannot_count = constraint_counts.get("cannot_link", 0)
    balance_total = must_count + cannot_count
    return {
        "unsureRate": _rate(unsure_count, answer_count),
        "caseletRepeatRate": _rate(repeated_endpoint_count, endpoint_total),
        "sourceClusterDominance": _rate(max(source_cluster_counts.values(), default=0), question_count),
        "mustCannotBalance": {
            "mustLinkCount": must_count,
            "cannotLinkCount": cannot_count,
            "mustLinkRate": _rate(must_count, balance_total),
            "cannotLinkRate": _rate(cannot_count, balance_total),
            "balanceScore": 1.0 - abs(_rate(must_count, balance_total) - _rate(cannot_count, balance_total)),
        },
        "weakLabelQuestionRate": _rate(weak_label_count, question_count),
        "mixedResidualQuestionRate": _rate(mixed_residual_count, question_count),
        "questionTypeDistribution": dict(sorted(type_counts.items())),
    }


def _question_source_cluster_id(question: dict[str, object]) -> str:
    source_cluster_id = _text_id(question.get("sourceClusterId"))
    if source_cluster_id:
        return source_cluster_id
    question_id = str(question.get("questionId") or "")
    parts = question_id.split("-")
    if len(parts) >= 3 and parts[0] in {"must", "cannot"}:
        return parts[2]
    return ""


def _rate(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round(numerator / denominator, 6)


def _text_id(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _review_context(item_id: str, row: dict[str, Any] | None) -> dict[str, object]:
    if row is None:
        return {
            "id": item_id,
            "summary": "근거를 찾을 수 없습니다.",
            "action": "",
            "object": "",
            "intentType": "unknown",
            "signals": [],
        }
    frame = row.get("actionObjectFrame")
    frame_payload = frame if isinstance(frame, dict) else {}
    action = str(frame_payload.get("action") or "").strip()
    object_term = str(frame_payload.get("object") or "").strip()
    intent_type = str(frame_payload.get("intentType") or "unknown").strip() or "unknown"
    signals = _signals(row, action=action, object_term=object_term)
    return {
        "id": item_id,
        "conversationId": str(row.get("conversationId") or row.get("id") or item_id),
        "summary": _summary(row, action=action, object_term=object_term),
        "action": action,
        "object": object_term,
        "intentType": intent_type,
        "signals": signals,
        "logExcerpt": _log_excerpt(row),
        "evidenceTurnIds": _string_list(row.get("evidenceTurnIds")),
    }


def _summary(row: dict[str, Any], *, action: str, object_term: str) -> str:
    if object_term and action:
        return f"{object_term} {action}"
    if object_term:
        return object_term
    if action:
        return action
    return _snippet(row)[:80] or "업무 추정 불가"


def _signals(row: dict[str, Any], *, action: str, object_term: str) -> list[str]:
    output: list[str] = []
    for value in (object_term, action, str(row.get("qualityTier") or "").strip()):
        if value and value not in output:
            output.append(value)
    workflow_signal = row.get("workflowSignal")
    if isinstance(workflow_signal, dict):
        signal_labels = {
            "requires_payment_check": "결제 확인 필요",
            "requires_user_identification": "본인 확인 필요",
            "has_escalation_cases": "이관/에스컬레이션 신호",
        }
        for key, label in signal_labels.items():
            if workflow_signal.get(key):
                output.append(label)
    return output[:6]


def _log_excerpt(row: dict[str, Any]) -> str:
    candidates = (
        row.get("canonicalText"),
        row.get("agentResolutionText"),
        row.get("agentActionText"),
        row.get("customerIssueText"),
        row.get("canonical_text"),
        row.get("customer_problem_text"),
    )
    for candidate in candidates:
        text = " ".join(str(candidate or "").split())
        if text:
            return text[:900]
    return ""


def _reason_label(reason: str) -> str:
    return {
        "same_source_cluster_split": "같은 클러스터에서 서로 다른 workflow 후보로 갈라졌습니다.",
        "low_confidence_cluster_boundary": "같은 클러스터로 묶였지만 경계 신뢰도가 낮습니다.",
    }.get(reason, "클러스터 경계 판단이 필요합니다.")


def _read_preprocessed_index(
    runtime_config: PipelineRuntimeConfig,
    stage_context: object,
) -> dict[str, dict[str, Any]]:
    preprocessing_path = (
        runtime_config.artifact_root
        / getattr(stage_context, "dag_id")
        / getattr(stage_context, "run_id").replace("/", "__")
        / "preprocessing"
        / "preprocessed_data.json"
    )
    payload = _read_json(preprocessing_path)
    rows = payload.get("issueCaselets") or payload.get("conversations")
    if not isinstance(rows, list):
        return {}
    output: dict[str, dict[str, Any]] = {}
    for row in rows:
        if isinstance(row, dict):
            for row_id in _row_ids(row):
                output[row_id] = row
    return output


def _flow_splitting_dir(runtime_config: PipelineRuntimeConfig, stage_context: object) -> Path:
    return (
        runtime_config.artifact_root
        / getattr(stage_context, "dag_id")
        / getattr(stage_context, "run_id").replace("/", "__")
        / "flow_splitting"
    )


def _read_json(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PipelineStageError(f"Failed to read JSON artifact: {path}") from exc
    if not isinstance(payload, dict):
        raise PipelineStageError(f"JSON artifact must be an object: {path}")
    return payload


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [text for item in value if (text := str(item).strip())]


def _row_ids(row: dict[str, Any]) -> list[str]:
    ids: list[str] = []
    for key in ("caseletId", "id", "conversationId"):
        row_id = str(row.get(key) or "").strip()
        if row_id and row_id not in ids:
            ids.append(row_id)
    return ids


def _snippet(row: dict[str, Any] | None) -> str:
    if row is None:
        return ""
    text = str(
        row.get("customerIssueText")
        or row.get("customer_problem_text")
        or row.get("customerProblemText")
        or row.get("canonicalText")
        or row.get("canonical_text")
        or ""
    )
    return " ".join(text.split())[:360]


def _question_limit() -> int:
    value = os.getenv("PIPELINE_FEEDBACK_QUESTION_LIMIT", "").strip()
    if not value:
        return MAX_QUESTIONS
    try:
        parsed = int(value)
    except ValueError:
        raise PipelineConfigurationError("PIPELINE_FEEDBACK_QUESTION_LIMIT must be an integer.")
    return max(0, min(50, parsed))


__all__ = ["ARTIFACT_NAME", "run"]
