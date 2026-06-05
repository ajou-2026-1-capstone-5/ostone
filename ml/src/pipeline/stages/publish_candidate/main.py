from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

from pipeline.common.artifacts import ensure_stage_directory
from pipeline.common.callbacks import CallbackResponse, PipelineCallbackError, post_callback
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineConfigurationError, PipelineStageError
from pipeline.stages.preprocessing.io import read_stage_context
from pipeline.stages.publish_candidate import payloads
from pipeline.stages.publish_candidate.state import (
    SUCCESS_RESPONSE_STATUSES,
    DomainPackContextLost,
    PublishCandidateResult,
    PublishCandidateResultWriter,
)

SCHEMA_VERSION = "1.0"
EVIDENCE_JSON_MAX_LEN = 5000
_ALLOWED_EVIDENCE_TYPES = frozenset({"keyword", "exemplar_conv_id", "member_conv_id"})
CALLBACK_DOMAIN_PACK = payloads.CALLBACK_DOMAIN_PACK
CALLBACK_INTENT = payloads.CALLBACK_INTENT
CALLBACK_WORKFLOW = payloads.CALLBACK_WORKFLOW
WORKFLOW_LIST_KEYS = payloads.WORKFLOW_LIST_KEYS
build_domain_pack_payload = payloads.build_domain_pack_payload
build_intent_payload = payloads.build_intent_payload
build_workflow_payload = payloads.build_workflow_payload


class PublishCandidateStageError(PipelineStageError):
    def __init__(self, message: str, manifest_payload: dict[str, object]) -> None:
        super().__init__(message)
        self.manifest_payload = manifest_payload


def run(upstream_manifest_path: str | None = None) -> dict[str, object]:
    runtime_config = PipelineRuntimeConfig.from_env()
    stage_context = read_stage_context(upstream_manifest_path, stage_name="publish_candidate")
    stage_dir = ensure_stage_directory(stage_context, runtime_config)
    result_writer = PublishCandidateResultWriter(stage_dir / "publish_candidate_result.json")
    result = result_writer.load() or PublishCandidateResult.initial(stage_context, SCHEMA_VERSION)

    try:
        candidate_path = _prepare_candidate_input(upstream_manifest_path, result, result_writer)
        if runtime_config.callback_enabled:
            _validate_pipeline_job_id(stage_context.pipeline_job_id)

        candidate = _load_valid_candidate(candidate_path)
        _surface_evaluation_review(candidate, result, result_writer)

        if _skip_callbacks_if_disabled(runtime_config, result, result_writer, candidate):
            return result.manifest_payload(result_writer.path)

        result.mark_running()
        result_writer.write(result)
        _run_callbacks(candidate, result, result_writer, stage_context, runtime_config)
        result.mark_succeeded()
        result_writer.write(result)
        return result.manifest_payload(result_writer.path)
    except PublishCandidateStageError:
        raise
    except PipelineCallbackError as exc:
        result.mark_failed(exc.callback_type, exc.to_error_object())
        result_writer.write(result)
        raise _stage_error(str(exc), result, result_writer) from exc
    except (PipelineConfigurationError, PipelineStageError, OSError, json.JSONDecodeError, ValueError) as exc:
        result.mark_failed(
            CALLBACK_DOMAIN_PACK if isinstance(exc, DomainPackContextLost) else None,
            {
                "type": type(exc).__name__,
                "message": str(exc),
                "responseBody": None,
                "parsedResponseBody": None,
            },
        )
        result_writer.write(result)
        raise _stage_error(str(exc), result, result_writer) from exc


def _prepare_candidate_input(
    upstream_manifest_path: str | None,
    result: PublishCandidateResult,
    result_writer: PublishCandidateResultWriter,
) -> Path:
    candidate_path = _read_candidate_artifact_path(upstream_manifest_path)
    result.set_candidate_artifact_path(candidate_path)
    result_writer.write(result)
    return candidate_path


def _load_valid_candidate(candidate_path: Path) -> dict[str, Any]:
    candidate = load_candidate(candidate_path)
    validate_candidate(candidate)
    return candidate


def _surface_evaluation_review(
    candidate: dict[str, Any],
    result: PublishCandidateResult,
    result_writer: PublishCandidateResultWriter,
) -> None:
    if not _evaluation_blocked(candidate):
        return

    evaluation_summary = candidate.get("evaluationSummary")
    review_reasons = []
    if isinstance(evaluation_summary, dict):
        evaluation_summary["needsHumanReview"] = True
        review_reasons = _string_list(evaluation_summary.get("qualityReviewReasons")) + _string_list(
            evaluation_summary.get("blockReasons")
        )
    candidate["needsHumanReview"] = True
    domain_pack_draft = _required_object(candidate, "domainPackDraft")
    summary = _parse_json_object(domain_pack_draft.get("summaryJson"))
    summary["needsHumanReview"] = True
    summary["evaluationPassed"] = False
    if review_reasons:
        summary["qualityReviewReasons"] = review_reasons
    domain_pack_draft["summaryJson"] = json.dumps(summary, ensure_ascii=False)
    result.mark_evaluation_needs_human_review()
    result_writer.write(result)


def _parse_json_object(value: object) -> dict[str, Any]:
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if isinstance(item, str) and item]


def _skip_callbacks_if_disabled(
    runtime_config: PipelineRuntimeConfig,
    result: PublishCandidateResult,
    result_writer: PublishCandidateResultWriter,
    candidate: dict[str, Any],
) -> bool:
    if runtime_config.callback_enabled:
        return False

    result.mark_skipped(len(_candidate_items(candidate)))
    result_writer.write(result)
    return True


def build_external_event_id(dag_id: str, run_id: str, callback_type: str, scope: str | None = None) -> str:
    return payloads.build_external_event_id(dag_id, run_id, callback_type, scope)


def load_candidate(candidate_path: Path) -> dict[str, Any]:
    candidate = json.loads(candidate_path.read_text(encoding="utf-8"))
    if not isinstance(candidate, dict):
        raise PipelineStageError(f"Candidate artifact must be a JSON object: {candidate_path}")
    return cast(dict[str, Any], candidate)


def validate_candidate(candidate: dict[str, Any]) -> None:
    candidate_items = _candidate_items(candidate)
    if len(candidate_items) > 1:
        for item in candidate_items:
            _validate_single_candidate(item)
        return
    _validate_single_candidate(candidate_items[0])


def _validate_single_candidate(candidate: dict[str, Any]) -> None:
    if candidate.get("schemaVersion") != SCHEMA_VERSION:
        raise PipelineStageError("Candidate schemaVersion must be '1.0'.")

    _validate_domain_pack_draft(candidate)
    intent_codes = _validate_intent_draft(candidate)
    workflow_lists = _validate_workflow_draft(candidate)
    slot_codes = _validate_slot_drafts(workflow_lists)
    _validate_policy_drafts(workflow_lists)
    _validate_risk_drafts(workflow_lists)
    _ = _validate_workflow_drafts(workflow_lists)
    _validate_intent_slot_bindings(workflow_lists, intent_codes, slot_codes)
    _validate_workflow_intent_codes(workflow_lists, intent_codes)


def _validate_domain_pack_draft(candidate: dict[str, Any]) -> None:
    domain_pack_draft = _required_object(candidate, "domainPackDraft")
    _required_non_blank(domain_pack_draft, "packKey", 100)
    _required_non_blank(domain_pack_draft, "packName", 255)


def _validate_intent_draft(candidate: dict[str, Any]) -> set[str]:
    intent_draft = _required_object(candidate, "intentDraft")
    intents = _required_list(intent_draft, "intents")
    if not intents:
        raise PipelineStageError("intentDraft.intents must contain at least one intent.")
    intent_codes = _validate_code_list(intents, "intentCode", "intentDraft.intents")
    for intent in intents:
        _required_non_blank(intent, "name", 255)
        _validate_representative_cases(intent)
    return intent_codes


def _validate_workflow_draft(candidate: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    workflow_draft = _required_object(candidate, "workflowDraft")
    workflow_lists = {key: _optional_list(workflow_draft, key) for key in WORKFLOW_LIST_KEYS}
    if not any(workflow_lists[key] for key in WORKFLOW_LIST_KEYS):
        raise PipelineStageError("workflowDraft must contain at least one draft component.")
    return workflow_lists


def _validate_slot_drafts(workflow_lists: dict[str, list[dict[str, Any]]]) -> set[str]:
    slot_codes = _validate_code_list(workflow_lists["slots"], "slotCode", "workflowDraft.slots")
    for slot in workflow_lists["slots"]:
        _required_non_blank(slot, "name", 255)
        _required_non_blank(slot, "dataType", 50)
    return slot_codes


def _validate_policy_drafts(workflow_lists: dict[str, list[dict[str, Any]]]) -> None:
    _validate_code_list(workflow_lists["policies"], "policyCode", "workflowDraft.policies")
    for policy in workflow_lists["policies"]:
        _required_non_blank(policy, "name", 255)


def _validate_risk_drafts(workflow_lists: dict[str, list[dict[str, Any]]]) -> None:
    _validate_code_list(workflow_lists["risks"], "riskCode", "workflowDraft.risks")
    for risk in workflow_lists["risks"]:
        _required_non_blank(risk, "name", 255)
        _required_non_blank(risk, "riskLevel", 50)


def _validate_workflow_drafts(workflow_lists: dict[str, list[dict[str, Any]]]) -> set[str]:
    workflow_codes = _validate_code_list(workflow_lists["workflows"], "workflowCode", "workflowDraft.workflows")
    for workflow in workflow_lists["workflows"]:
        _required_non_blank(workflow, "name", 255)
        _required_non_blank(workflow, "graphJson", 20000)
        _validate_evidence_json(
            workflow.get("evidenceJson"),
            context="workflowDraft.workflows[*].evidenceJson",
        )
    return workflow_codes


def _validate_intent_slot_bindings(
    workflow_lists: dict[str, list[dict[str, Any]]],
    intent_codes: set[str],
    slot_codes: set[str],
) -> None:
    for binding in workflow_lists["intentSlotBindings"]:
        intent_code = _required_non_blank(binding, "intentCode", 100)
        slot_code = _required_non_blank(binding, "slotCode", 100)
        if intent_code not in intent_codes:
            raise PipelineStageError(f"intentSlotBindings references unknown intentCode: {intent_code}")
        if slot_code not in slot_codes:
            raise PipelineStageError(f"intentSlotBindings references unknown slotCode: {slot_code}")


def _validate_workflow_intent_codes(
    workflow_lists: dict[str, list[dict[str, Any]]],
    intent_codes: set[str],
) -> None:
    for workflow in workflow_lists["workflows"]:
        intent_code = _required_non_blank(workflow, "intentCode", 100)
        if intent_code not in intent_codes:
            raise PipelineStageError(f"workflow references unknown intentCode: {intent_code}")


def apply_domain_pack_response(
    result: dict[str, Any],
    parsed_response_body: object | None,
    scope: str | None = None,
) -> None:
    state = PublishCandidateResult.from_payload(result)
    state.apply_domain_pack_response(parsed_response_body, scope)
    result.clear()
    result.update(state.to_payload())


def _run_callbacks(
    candidate: dict[str, Any],
    result: PublishCandidateResult,
    result_writer: PublishCandidateResultWriter,
    stage_context: StageContext,
    runtime_config: PipelineRuntimeConfig,
) -> None:
    _candidate_items(candidate)
    result.candidate_count = 1
    _run_candidate_callbacks(
        candidate,
        result,
        result_writer,
        stage_context,
        runtime_config,
        None,
        final_callback=True,
    )


def _run_candidate_callbacks(
    candidate: dict[str, Any],
    result: PublishCandidateResult,
    result_writer: PublishCandidateResultWriter,
    stage_context: StageContext,
    runtime_config: PipelineRuntimeConfig,
    scope: str | None,
    *,
    final_callback: bool,
) -> None:
    if not result.has_successful_callback(CALLBACK_DOMAIN_PACK, scope):
        domain_payload = build_domain_pack_payload(candidate, stage_context, scope)
        domain_response = _post_callback(domain_payload, CALLBACK_DOMAIN_PACK, stage_context, runtime_config)
        _validate_callback_response(domain_response)
        result.append_callback_response(domain_response, scope)
        result.apply_domain_pack_response(domain_response.parsed_response_body, scope)
        result_writer.write(result)

    domain_pack_version_id = result.domain_pack_version_id_for(scope)
    if domain_pack_version_id is None:
        result.mark_failed(
            CALLBACK_DOMAIN_PACK,
            {
                "type": "DomainPackContextLost",
                "message": "domainPackVersionId is unavailable after domain-pack-drafts callback.",
                "responseBody": None,
                "parsedResponseBody": None,
            },
        )
        result_writer.write(result)
        raise _stage_error("Domain pack callback context was lost.", result, result_writer)

    if not result.has_successful_callback(CALLBACK_INTENT, scope):
        intent_payload = build_intent_payload(candidate, stage_context, domain_pack_version_id, scope)
        intent_response = _post_callback(intent_payload, CALLBACK_INTENT, stage_context, runtime_config)
        _validate_callback_response(intent_response)
        result.append_callback_response(intent_response, scope)
        result_writer.write(result)

    if not result.has_successful_callback(CALLBACK_WORKFLOW, scope):
        workflow_payload = build_workflow_payload(
            candidate,
            stage_context,
            domain_pack_version_id,
            scope,
            final_callback=final_callback,
        )
        workflow_response = _post_callback(workflow_payload, CALLBACK_WORKFLOW, stage_context, runtime_config)
        _validate_callback_response(workflow_response)
        result.append_callback_response(workflow_response, scope)
        result_writer.write(result)


def _post_callback(
    payload: dict[str, object],
    callback_type: str,
    stage_context: StageContext,
    runtime_config: PipelineRuntimeConfig,
) -> CallbackResponse:
    return post_callback(
        runtime_config.backend_base_url,
        _require_pipeline_job_id(stage_context.pipeline_job_id),
        callback_type,
        payload,
        runtime_config.airflow_webhook_secret or "",
        runtime_config.callback_timeout_seconds,
    )


def _read_candidate_artifact_path(upstream_manifest_path: str | None) -> Path:
    if upstream_manifest_path is None:
        raise PipelineConfigurationError("upstream_manifest_path must not be None.")
    manifest_path = Path(upstream_manifest_path)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict):
        raise PipelineStageError(f"Upstream manifest must be a JSON object: {manifest_path}")
    payload = manifest.get("payload")
    if not isinstance(payload, dict):
        raise PipelineStageError("Upstream manifest payload must be a JSON object.")
    candidate_path_value = payload.get("candidateArtifactPath")
    if not isinstance(candidate_path_value, str) or not candidate_path_value:
        raise PipelineStageError("Upstream manifest payload.candidateArtifactPath is required.")
    candidate_path = Path(candidate_path_value)
    if candidate_path.is_absolute():
        return candidate_path
    return manifest_path.parent / candidate_path


def _stage_error(
    message: str,
    result: PublishCandidateResult,
    result_writer: PublishCandidateResultWriter,
) -> PublishCandidateStageError:
    return PublishCandidateStageError(message, result.manifest_payload(result_writer.path))


def _evaluation_blocked(candidate: dict[str, Any]) -> bool:
    evaluation_summary = candidate.get("evaluationSummary")
    if isinstance(evaluation_summary, dict) and evaluation_summary.get("passed") is False:
        return True
    return any(_evaluation_blocked(item) for item in _candidate_items(candidate) if item is not candidate)


def _validate_callback_response(response: CallbackResponse) -> None:
    if response.response_status in SUCCESS_RESPONSE_STATUSES:
        return
    raise PipelineCallbackError(
        message=f"Spring callback returned unexpected status: responseStatus={response.response_status}",
        callback_type=response.callback_type,
        external_event_id=response.external_event_id,
        endpoint=response.endpoint,
        http_status=response.http_status,
        response_body=response.response_body,
        response_body_truncated=response.response_body_truncated,
        parsed_response_body=response.parsed_response_body,
    )


def _candidate_items(candidate: dict[str, Any]) -> list[dict[str, Any]]:
    candidates = candidate.get("candidates")
    if candidates is None:
        return [candidate]
    raise PipelineStageError(
        "Candidate artifact must describe exactly one domain pack; candidates arrays are not supported."
    )


def _required_object(payload: dict[str, Any], key: str) -> dict[str, Any]:
    value = payload.get(key)
    if not isinstance(value, dict):
        raise PipelineStageError(f"{key} must be a JSON object.")
    return cast(dict[str, Any], value)


def _required_list(payload: dict[str, Any], key: str) -> list[dict[str, Any]]:
    value = payload.get(key)
    if not isinstance(value, list):
        raise PipelineStageError(f"{key} must be a JSON array.")
    if not all(isinstance(item, dict) for item in value):
        raise PipelineStageError(f"{key} must contain JSON objects.")
    return cast(list[dict[str, Any]], value)


def _optional_list(payload: dict[str, Any], key: str) -> list[dict[str, Any]]:
    value = payload.get(key)
    if value is None:
        return []
    if not isinstance(value, list):
        raise PipelineStageError(f"{key} must be a JSON array.")
    if not all(isinstance(item, dict) for item in value):
        raise PipelineStageError(f"{key} must contain JSON objects.")
    return cast(list[dict[str, Any]], value)


def _validate_code_list(items: list[dict[str, Any]], code_key: str, owner: str) -> set[str]:
    codes: set[str] = set()
    for item in items:
        code = _required_non_blank(item, code_key, 100)
        if code in codes:
            raise PipelineStageError(f"{owner}.{code_key} contains duplicate code: {code}")
        codes.add(code)
    return codes


def _validate_case_text_fields(case: dict[str, Any]) -> None:
    canonical_text = case.get("canonicalText")
    if not isinstance(canonical_text, str) or not canonical_text.strip():
        raise PipelineStageError("representativeCases[*].canonicalText must be a non-blank string.")
    customer_problem_text = case.get("customerProblemText")
    if not isinstance(customer_problem_text, str) or not customer_problem_text.strip():
        raise PipelineStageError("representativeCases[*].customerProblemText must be a non-blank string.")
    ended_status = case.get("endedStatus")
    if ended_status is not None and not isinstance(ended_status, str):
        raise PipelineStageError("representativeCases[*].endedStatus must be a string or null.")


def _validate_representative_case(case: Any, seen_ids: set[str]) -> None:
    if not isinstance(case, dict):
        raise PipelineStageError("intents[*].representativeCases must be a JSON array.")
    conv_id = case.get("conversationId")
    if not isinstance(conv_id, str) or not conv_id.strip() or len(conv_id) > 100:
        raise PipelineStageError("representativeCases[*].conversationId must be a non-blank string up to 100 chars.")
    if conv_id in seen_ids:
        raise PipelineStageError(f"representativeCases[*].conversationId duplicates within an intent: {conv_id}.")
    seen_ids.add(conv_id)
    _validate_case_text_fields(case)


def _validate_representative_cases(intent: dict[str, Any]) -> None:
    cases = intent.get("representativeCases")
    if not isinstance(cases, list):
        raise PipelineStageError("intents[*].representativeCases must be a JSON array.")
    if len(cases) > 3:
        raise PipelineStageError("intents[*].representativeCases must contain at most 3 items.")
    seen_ids: set[str] = set()
    for case in cases:
        _validate_representative_case(case, seen_ids)


def _required_non_blank(payload: dict[str, Any], key: str, max_length: int) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise PipelineStageError(f"{key} must be a non-blank string.")
    if len(value) > max_length:
        raise PipelineStageError(f"{key} must be {max_length} characters or fewer.")
    return value


def _validate_pipeline_job_id(value: str | None) -> None:
    _require_pipeline_job_id(value)


def _require_pipeline_job_id(value: str | None) -> str:
    if not isinstance(value, str) or not value.isdecimal():
        raise PipelineConfigurationError("pipeline_job_id must be a numeric string when callbacks are enabled.")
    return value


def _int_or_none(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdecimal():
        return int(value)
    return None


def _validate_evidence_json(value: object, *, context: str) -> None:
    if value is None:
        return
    if not isinstance(value, str):
        raise PipelineStageError(f"{context} must be a string when present.")
    if len(value) > EVIDENCE_JSON_MAX_LEN:
        raise PipelineStageError(f"{context} length ({len(value)}) exceeds {EVIDENCE_JSON_MAX_LEN}.")
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError as exc:
        raise PipelineStageError(f"{context} must be valid JSON.") from exc
    if not isinstance(parsed, list):
        raise PipelineStageError(f"{context} must encode a JSON array.")
    for item in parsed:
        if not isinstance(item, dict):
            raise PipelineStageError(f"{context} items must be objects.")
        if item.get("type") not in _ALLOWED_EVIDENCE_TYPES:
            raise PipelineStageError(f"{context} item has unsupported type {item.get('type')!r}.")
        value_field = item.get("value")
        if not isinstance(value_field, str) or not value_field.strip():
            raise PipelineStageError(f"{context} item 'value' must be a non-blank string.")
