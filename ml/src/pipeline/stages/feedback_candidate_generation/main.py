from __future__ import annotations

import json
import os
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from pipeline.common.artifacts import ensure_stage_directory, write_stage_manifest
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.exceptions import PipelineConfigurationError, PipelineStageError
from pipeline.stages.flow_splitting.constants import CLUSTERS_ARTIFACT, WORKFLOW_ENTRYPOINTS_ARTIFACT
from pipeline.stages.preprocessing.io import read_stage_context

ARTIFACT_NAME = "feedback_review_questions.json"
MAX_QUESTIONS = 12


def run(upstream_manifest_path: str | None = None) -> dict[str, object]:
    started_at = time.monotonic()
    runtime_config = PipelineRuntimeConfig.from_env()
    stage_context = read_stage_context(upstream_manifest_path, stage_name="feedback_candidate_generation")
    output_dir = ensure_stage_directory(stage_context, runtime_config)
    flow_dir = _flow_splitting_dir(runtime_config, stage_context)
    clusters_payload = _read_json(flow_dir / CLUSTERS_ARTIFACT)
    entrypoints_payload = _read_json(flow_dir / WORKFLOW_ENTRYPOINTS_ARTIFACT)
    preprocessed_index = _read_preprocessed_index(runtime_config, stage_context)
    questions = _build_questions(
        clusters_payload,
        entrypoints_payload,
        preprocessed_index,
        limit=_question_limit(),
    )
    payload: dict[str, object] = {
        "schemaVersion": "feedback-review-questions.v1",
        "stage": "feedback_candidate_generation",
        "generatedAt": datetime.now(UTC).isoformat(),
        "questionText": "두 상담을 같은 intent로 묶어도 되나요?",
        "answerOptions": ["must_link", "cannot_link", "unsure"],
        "questionCount": len(questions),
        "questions": questions,
        "durationSeconds": round(time.monotonic() - started_at, 4),
    }
    artifact_path = output_dir / ARTIFACT_NAME
    artifact_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    manifest_path = write_stage_manifest(
        stage_context,
        runtime_config,
        {
            "upstream_manifest_path": upstream_manifest_path,
            "feedbackQuestionsPath": artifact_path.name,
            "recordCount": len(questions),
            "metrics": {
                "feedbackQuestionCount": len(questions),
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
) -> list[dict[str, object]]:
    questions: list[dict[str, object]] = []
    entrypoints = [item for item in entrypoints_payload.get("workflowEntryPoints", []) if isinstance(item, dict)]
    clusters = [item for item in clusters_payload.get("clusters", []) if isinstance(item, dict)]
    questions.extend(_cannot_link_questions(entrypoints, preprocessed_index, limit=limit))
    if len(questions) < limit:
        questions.extend(_must_link_questions(clusters, preprocessed_index, limit=limit - len(questions)))
    return questions[:limit]


def _cannot_link_questions(
    entrypoints: list[dict[str, Any]],
    preprocessed_index: dict[str, dict[str, Any]],
    *,
    limit: int,
) -> list[dict[str, object]]:
    output: list[dict[str, object]] = []
    for source, items in _entrypoints_by_source(entrypoints).items():
        if len(items) < 2:
            continue
        output.extend(_cannot_link_questions_for_source(source, items, preprocessed_index, limit - len(output)))
        if len(output) >= limit:
            return output[:limit]
    return output


def _entrypoints_by_source(entrypoints: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    by_source: dict[str, list[dict[str, Any]]] = {}
    for entrypoint in entrypoints:
        source = str(entrypoint.get("sourceClusterId") or "")
        if source:
            by_source.setdefault(source, []).append(entrypoint)
    return by_source


def _cannot_link_questions_for_source(
    source: str,
    items: list[dict[str, Any]],
    preprocessed_index: dict[str, dict[str, Any]],
    limit: int,
) -> list[dict[str, object]]:
    output: list[dict[str, object]] = []
    ordered = sorted(items, key=lambda item: float(item.get("confidence") or 0.0))
    for index, left in enumerate(ordered):
        for right in ordered[index + 1 :]:
            pair = _representative_pair(left, right)
            if pair is None:
                continue
            output.append(
                _question(
                    question_id=f"cannot-link-{source}-{len(output) + 1}",
                    source_id=pair[0],
                    target_id=pair[1],
                    preprocessed_index=preprocessed_index,
                    expected_type="cannot_link",
                    reason="same_source_cluster_split",
                    priority="HIGH",
                )
            )
            if len(output) >= limit:
                return output
    return output


def _must_link_questions(
    clusters: list[dict[str, Any]],
    preprocessed_index: dict[str, dict[str, Any]],
    *,
    limit: int,
) -> list[dict[str, object]]:
    output: list[dict[str, object]] = []
    ordered = sorted(clusters, key=lambda item: float(item.get("workflow_confidence") or item.get("confidence") or 0.0))
    for cluster in ordered:
        member_ids = _string_list(cluster.get("exemplar_conv_ids")) or _string_list(cluster.get("member_conv_ids"))
        if len(member_ids) < 2:
            continue
        output.append(
            _question(
                question_id=f"must-link-{cluster.get('cluster_id', len(output))}-{len(output) + 1}",
                source_id=member_ids[0],
                target_id=member_ids[1],
                preprocessed_index=preprocessed_index,
                expected_type="must_link",
                reason="low_confidence_cluster_boundary",
                priority="NORMAL",
            )
        )
        if len(output) >= limit:
            break
    return output


def _question(
    *,
    question_id: str,
    source_id: str,
    target_id: str,
    preprocessed_index: dict[str, dict[str, Any]],
    expected_type: str,
    reason: str,
    priority: str,
) -> dict[str, object]:
    return {
        "questionId": question_id,
        "questionText": "두 상담을 같은 intent로 묶어도 되나요?",
        "sourceId": source_id,
        "targetId": target_id,
        "sourceReviewContext": _review_context(source_id, preprocessed_index.get(source_id)),
        "targetReviewContext": _review_context(target_id, preprocessed_index.get(target_id)),
        "sourceSnippet": _snippet(preprocessed_index.get(source_id)),
        "targetSnippet": _snippet(preprocessed_index.get(target_id)),
        "recommendedConstraintType": expected_type,
        "reason": reason,
        "reasonLabel": _reason_label(reason),
        "priority": priority,
    }


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


def _representative_pair(left: dict[str, Any], right: dict[str, Any]) -> tuple[str, str] | None:
    left_ids = _string_list(left.get("exemplarConversationIds")) or _string_list(left.get("memberConversationIds"))
    right_ids = _string_list(right.get("exemplarConversationIds")) or _string_list(right.get("memberConversationIds"))
    if not left_ids or not right_ids:
        return None
    return left_ids[0], right_ids[0]


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
