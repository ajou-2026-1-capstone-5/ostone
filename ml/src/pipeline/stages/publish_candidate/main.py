from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path
from typing import Any, cast

from pipeline.common.artifacts import ensure_stage_directory
from pipeline.common.callbacks import CallbackResponse, PipelineCallbackError, post_callback
from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineConfigurationError, PipelineStageError
from pipeline.stages.preprocessing.io import read_stage_context

SCHEMA_VERSION = "1.0"
EVIDENCE_JSON_MAX_LEN = 5000
_ALLOWED_EVIDENCE_TYPES = frozenset({"keyword", "exemplar_conv_id", "member_conv_id"})
CALLBACK_DOMAIN_PACK = "domain-pack-drafts"
CALLBACK_INTENT = "intent-drafts"
CALLBACK_WORKFLOW = "workflow-drafts"
SUCCESS_RESPONSE_STATUSES = {"CREATED", "DUPLICATE_IGNORED", "OK", "SUCCEEDED"}
WORKFLOW_LIST_KEYS = (
    "slots",
    "policies",
    "risks",
    "workflows",
    "intentSlotBindings",
    "intentWorkflowBindings",
)


class PublishCandidateStageError(PipelineStageError):
    def __init__(self, message: str, manifest_payload: dict[str, object]) -> None:
        super().__init__(message)
        self.manifest_payload = manifest_payload


class DomainPackContextLost(PipelineStageError):
    pass


def run(upstream_manifest_path: str | None = None) -> dict[str, object]:
    runtime_config = PipelineRuntimeConfig.from_env()
    stage_context = read_stage_context(upstream_manifest_path, stage_name="publish_candidate")
    stage_dir = ensure_stage_directory(stage_context, runtime_config)
    result_path = stage_dir / "publish_candidate_result.json"
    result = _load_existing_result(result_path) or _initial_result(stage_context)

    try:
        candidate_path = _prepare_candidate_input(upstream_manifest_path, result, result_path)
        if runtime_config.callback_enabled:
            _validate_pipeline_job_id(stage_context.pipeline_job_id)

        candidate = _load_valid_candidate(candidate_path)
        _raise_if_evaluation_blocked(candidate, result, result_path)

        if _skip_callbacks_if_disabled(runtime_config, result, result_path, candidate):
            return _manifest_payload(result, result_path)

        _mark_running(result, result_path)
        _run_callbacks(candidate, result, result_path, stage_context, runtime_config)
        _mark_succeeded(result, result_path)
        return _manifest_payload(result, result_path)
    except PublishCandidateStageError:
        raise
    except PipelineCallbackError as exc:
        result["publishStatus"] = "FAILED"
        result["failedCallbackType"] = exc.callback_type
        result["error"] = exc.to_error_object()
        _write_result(result_path, result)
        raise _stage_error(str(exc), result, result_path) from exc
    except (PipelineConfigurationError, PipelineStageError, OSError, json.JSONDecodeError, ValueError) as exc:
        result["publishStatus"] = "FAILED"
        result["failedCallbackType"] = CALLBACK_DOMAIN_PACK if isinstance(exc, DomainPackContextLost) else None
        result["error"] = {
            "type": type(exc).__name__,
            "message": str(exc),
            "responseBody": None,
            "parsedResponseBody": None,
        }
        _write_result(result_path, result)
        raise _stage_error(str(exc), result, result_path) from exc


def _prepare_candidate_input(
    upstream_manifest_path: str | None,
    result: dict[str, Any],
    result_path: Path,
) -> Path:
    candidate_path = _read_candidate_artifact_path(upstream_manifest_path)
    result["candidateArtifactPath"] = str(candidate_path)
    _write_result(result_path, result)
    return candidate_path


def _load_valid_candidate(candidate_path: Path) -> dict[str, Any]:
    candidate = load_candidate(candidate_path)
    validate_candidate(candidate)
    return candidate


def _raise_if_evaluation_blocked(candidate: dict[str, Any], result: dict[str, Any], result_path: Path) -> None:
    if not _evaluation_blocked(candidate):
        return

    result.update(
        {
            "publishStatus": "BLOCKED_BY_EVALUATION",
            "blockReason": "evaluationSummary.passed=false",
            "callbackResults": [],
            "failedCallbackType": None,
            "error": {
                "type": "EvaluationBlocked",
                "message": "Candidate did not pass evaluation gate",
                "responseBody": None,
                "parsedResponseBody": None,
            },
        }
    )
    _write_result(result_path, result)
    raise _stage_error("Candidate did not pass evaluation gate.", result, result_path)


def _skip_callbacks_if_disabled(
    runtime_config: PipelineRuntimeConfig,
    result: dict[str, Any],
    result_path: Path,
    candidate: dict[str, Any],
) -> bool:
    if runtime_config.callback_enabled:
        return False

    result.update(
        {
            "publishStatus": "SKIPPED",
            "skipReason": "CALLBACK_DISABLED",
            "domainPackId": None,
            "domainPackVersionId": None,
            "versionNo": None,
            "candidateCount": len(_candidate_items(candidate)),
            "domainPackContexts": {},
            "failedCallbackType": None,
            "callbackResults": [],
            "error": None,
        }
    )
    _write_result(result_path, result)
    return True


def _mark_running(result: dict[str, Any], result_path: Path) -> None:
    result["publishStatus"] = "RUNNING"
    result["error"] = None
    result["failedCallbackType"] = None
    _write_result(result_path, result)


def _mark_succeeded(result: dict[str, Any], result_path: Path) -> None:
    result["publishStatus"] = "SUCCEEDED"
    result["failedCallbackType"] = None
    result["error"] = None
    _write_result(result_path, result)


def build_external_event_id(dag_id: str, run_id: str, callback_type: str, scope: str | None = None) -> str:
    scoped_callback = f"{callback_type}:{scope}" if scope else callback_type
    candidate = f"{dag_id}:{run_id}:{scoped_callback}"
    if len(candidate) <= 255:
        return candidate
    canonical_payload = json.dumps(
        {"callback_type": callback_type, "dag_id": dag_id, "run_id": run_id, "scope": scope},
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    digest = hashlib.sha256(canonical_payload.encode("utf-8")).hexdigest()
    return f"airflow:{callback_type}:{digest}"


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

    domain_pack_draft = _required_object(candidate, "domainPackDraft")
    _required_non_blank(domain_pack_draft, "packKey", 100)
    _required_non_blank(domain_pack_draft, "packName", 255)

    intent_draft = _required_object(candidate, "intentDraft")
    intents = _required_list(intent_draft, "intents")
    if not intents:
        raise PipelineStageError("intentDraft.intents must contain at least one intent.")
    intent_codes = _validate_code_list(intents, "intentCode", "intentDraft.intents")
    for intent in intents:
        _required_non_blank(intent, "name", 255)
        _validate_representative_cases(intent)

    workflow_draft = _required_object(candidate, "workflowDraft")
    workflow_lists = {key: _optional_list(workflow_draft, key) for key in WORKFLOW_LIST_KEYS}
    if not any(workflow_lists[key] for key in WORKFLOW_LIST_KEYS):
        raise PipelineStageError("workflowDraft must contain at least one draft component.")

    slot_codes = _validate_code_list(workflow_lists["slots"], "slotCode", "workflowDraft.slots")
    for slot in workflow_lists["slots"]:
        _required_non_blank(slot, "name", 255)
        _required_non_blank(slot, "dataType", 50)

    _validate_code_list(workflow_lists["policies"], "policyCode", "workflowDraft.policies")
    for policy in workflow_lists["policies"]:
        _required_non_blank(policy, "name", 255)

    _validate_code_list(workflow_lists["risks"], "riskCode", "workflowDraft.risks")
    for risk in workflow_lists["risks"]:
        _required_non_blank(risk, "name", 255)
        _required_non_blank(risk, "riskLevel", 50)

    workflow_codes = _validate_code_list(workflow_lists["workflows"], "workflowCode", "workflowDraft.workflows")
    for workflow in workflow_lists["workflows"]:
        _required_non_blank(workflow, "name", 255)
        _required_non_blank(workflow, "graphJson", 20000)
        _validate_evidence_json(
            workflow.get("evidenceJson"),
            context="workflowDraft.workflows[*].evidenceJson",
        )

    for binding in workflow_lists["intentSlotBindings"]:
        intent_code = _required_non_blank(binding, "intentCode", 100)
        slot_code = _required_non_blank(binding, "slotCode", 100)
        if intent_code not in intent_codes:
            raise PipelineStageError(f"intentSlotBindings references unknown intentCode: {intent_code}")
        if slot_code not in slot_codes:
            raise PipelineStageError(f"intentSlotBindings references unknown slotCode: {slot_code}")

    for binding in workflow_lists["intentWorkflowBindings"]:
        intent_code = _required_non_blank(binding, "intentCode", 100)
        workflow_code = _required_non_blank(binding, "workflowCode", 100)
        if intent_code not in intent_codes:
            raise PipelineStageError(f"intentWorkflowBindings references unknown intentCode: {intent_code}")
        if workflow_code not in workflow_codes:
            raise PipelineStageError(f"intentWorkflowBindings references unknown workflowCode: {workflow_code}")


def build_domain_pack_payload(
    candidate: dict[str, Any],
    stage_context: StageContext,
    scope: str | None = None,
) -> dict[str, object]:
    domain_pack_draft = _required_object(candidate, "domainPackDraft")
    return {
        "externalEventId": build_external_event_id(
            stage_context.dag_id,
            stage_context.run_id,
            CALLBACK_DOMAIN_PACK,
            scope,
        ),
        "packKey": domain_pack_draft["packKey"],
        "packName": domain_pack_draft["packName"],
        "summaryJson": domain_pack_draft.get("summaryJson"),
    }


def build_intent_payload(
    candidate: dict[str, Any],
    stage_context: StageContext,
    domain_pack_version_id: int,
    scope: str | None = None,
) -> dict[str, object]:
    intent_draft = _required_object(candidate, "intentDraft")
    return {
        "externalEventId": build_external_event_id(
            stage_context.dag_id,
            stage_context.run_id,
            CALLBACK_INTENT,
            scope,
        ),
        "domainPackVersionId": domain_pack_version_id,
        "intents": copy.deepcopy(intent_draft["intents"]),
    }


def build_workflow_payload(
    candidate: dict[str, Any],
    stage_context: StageContext,
    domain_pack_version_id: int,
    scope: str | None = None,
    final_callback: bool = True,
) -> dict[str, object]:
    workflow_draft = _required_object(candidate, "workflowDraft")
    payload: dict[str, object] = {
        "externalEventId": build_external_event_id(
            stage_context.dag_id,
            stage_context.run_id,
            CALLBACK_WORKFLOW,
            scope,
        ),
        "domainPackVersionId": domain_pack_version_id,
        "finalCallback": final_callback,
    }
    for key in WORKFLOW_LIST_KEYS:
        payload[key] = copy.deepcopy(workflow_draft.get(key) or [])
    return payload


def apply_domain_pack_response(
    result: dict[str, Any],
    parsed_response_body: object | None,
    scope: str | None = None,
) -> None:
    if not isinstance(parsed_response_body, dict):
        raise DomainPackContextLost("domain-pack-drafts response body must be a JSON object.")

    domain_pack_id = _int_or_none(parsed_response_body.get("domainPackId"))
    domain_pack_version_id = _int_or_none(parsed_response_body.get("domainPackVersionId"))
    version_no = _int_or_none(parsed_response_body.get("versionNo"))
    if domain_pack_version_id is None:
        raise DomainPackContextLost("domain-pack-drafts response did not include domainPackVersionId.")

    result["domainPackId"] = domain_pack_id
    result["domainPackVersionId"] = domain_pack_version_id
    result["versionNo"] = version_no
    if scope is not None:
        contexts = result.get("domainPackContexts")
        if not isinstance(contexts, dict):
            contexts = {}
        contexts[scope] = {
            "domainPackId": domain_pack_id,
            "domainPackVersionId": domain_pack_version_id,
            "versionNo": version_no,
        }
        result["domainPackContexts"] = contexts


def _domain_pack_version_id(result: dict[str, Any], scope: str | None) -> int | None:
    if scope is None:
        return _int_or_none(result.get("domainPackVersionId"))
    contexts = result.get("domainPackContexts")
    if isinstance(contexts, dict):
        context = contexts.get(scope)
        if isinstance(context, dict):
            return _int_or_none(context.get("domainPackVersionId"))
    for callback in reversed(_callback_results(result)):
        if callback.get("type") != CALLBACK_DOMAIN_PACK or callback.get("scope") != scope:
            continue
        parsed = callback.get("parsedResponseBody")
        if isinstance(parsed, dict):
            return _int_or_none(parsed.get("domainPackVersionId"))
    return None


def _run_callbacks(
    candidate: dict[str, Any],
    result: dict[str, Any],
    result_path: Path,
    stage_context: StageContext,
    runtime_config: PipelineRuntimeConfig,
) -> None:
    candidates = _candidate_items(candidate)
    result["candidateCount"] = len(candidates)
    for index, current_candidate in enumerate(candidates):
        scope = _candidate_scope(current_candidate, index) if len(candidates) > 1 else None
        _run_candidate_callbacks(
            current_candidate,
            result,
            result_path,
            stage_context,
            runtime_config,
            scope,
            final_callback=index == len(candidates) - 1,
        )


def _run_candidate_callbacks(
    candidate: dict[str, Any],
    result: dict[str, Any],
    result_path: Path,
    stage_context: StageContext,
    runtime_config: PipelineRuntimeConfig,
    scope: str | None,
    *,
    final_callback: bool,
) -> None:
    if not _has_successful_callback(result, CALLBACK_DOMAIN_PACK, scope):
        domain_payload = build_domain_pack_payload(candidate, stage_context, scope)
        domain_response = _post_callback(domain_payload, CALLBACK_DOMAIN_PACK, stage_context, runtime_config)
        _validate_callback_response(domain_response)
        _append_callback_result(result, domain_response.to_result_entry(), scope)
        apply_domain_pack_response(result, domain_response.parsed_response_body, scope)
        _write_result(result_path, result)

    domain_pack_version_id = _domain_pack_version_id(result, scope)
    if domain_pack_version_id is None:
        result["publishStatus"] = "FAILED"
        result["failedCallbackType"] = CALLBACK_DOMAIN_PACK
        result["error"] = {
            "type": "DomainPackContextLost",
            "message": "domainPackVersionId is unavailable after domain-pack-drafts callback.",
            "responseBody": None,
            "parsedResponseBody": None,
        }
        _write_result(result_path, result)
        raise _stage_error("Domain pack callback context was lost.", result, result_path)

    if not _has_successful_callback(result, CALLBACK_INTENT, scope):
        intent_payload = build_intent_payload(candidate, stage_context, domain_pack_version_id, scope)
        intent_response = _post_callback(intent_payload, CALLBACK_INTENT, stage_context, runtime_config)
        _validate_callback_response(intent_response)
        _append_callback_result(result, intent_response.to_result_entry(), scope)
        _write_result(result_path, result)

    if not _has_successful_callback(result, CALLBACK_WORKFLOW, scope):
        workflow_payload = build_workflow_payload(
            candidate,
            stage_context,
            domain_pack_version_id,
            scope,
            final_callback=final_callback,
        )
        workflow_response = _post_callback(workflow_payload, CALLBACK_WORKFLOW, stage_context, runtime_config)
        _validate_callback_response(workflow_response)
        _append_callback_result(result, workflow_response.to_result_entry(), scope)
        _write_result(result_path, result)


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


def _initial_result(stage_context: StageContext) -> dict[str, Any]:
    return {
        "schemaVersion": SCHEMA_VERSION,
        "publishStatus": "PENDING",
        "pipelineContext": {
            "dagId": stage_context.dag_id,
            "runId": stage_context.run_id,
            "pipelineJobId": stage_context.pipeline_job_id,
            "workspaceId": stage_context.workspace_id,
            "datasetId": stage_context.dataset_id,
        },
        "candidateArtifactPath": None,
        "domainPackId": None,
        "domainPackVersionId": None,
        "versionNo": None,
        "candidateCount": 0,
        "domainPackContexts": {},
        "failedCallbackType": None,
        "callbackResults": [],
        "error": None,
    }


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


def _load_existing_result(result_path: Path) -> dict[str, Any] | None:
    if not result_path.exists():
        return None
    result = json.loads(result_path.read_text(encoding="utf-8"))
    if not isinstance(result, dict):
        raise PipelineStageError(f"Existing publish result must be a JSON object: {result_path}")
    return cast(dict[str, Any], result)


def _write_result(result_path: Path, result: dict[str, Any]) -> None:
    result_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")


def _manifest_payload(result: dict[str, Any], result_path: Path) -> dict[str, object]:
    callbacks = []
    for callback in _callback_results(result):
        callbacks.append(
            {
                "type": callback.get("type"),
                "scope": callback.get("scope"),
                "external_event_id": callback.get("externalEventId"),
                "http_status": callback.get("httpStatus"),
                "response_status": callback.get("responseStatus"),
            }
        )

    return {
        "status": _manifest_status(result),
        "candidate_artifact_path": result.get("candidateArtifactPath"),
        "publish_result_path": str(result_path.resolve()),
        "domain_pack_id": result.get("domainPackId"),
        "domain_pack_version_id": result.get("domainPackVersionId"),
        "domain_pack_contexts": result.get("domainPackContexts"),
        "candidate_count": result.get("candidateCount"),
        "version_no": result.get("versionNo"),
        "callbacks": callbacks,
        "failed_callback_type": result.get("failedCallbackType"),
        "publish_status": result.get("publishStatus"),
    }


def _manifest_status(result: dict[str, Any]) -> str:
    publish_status = result.get("publishStatus")
    if publish_status == "SUCCEEDED":
        return "completed"
    if publish_status in {"FAILED", "BLOCKED_BY_EVALUATION"}:
        return "failed"
    return str(publish_status).lower()


def _stage_error(message: str, result: dict[str, Any], result_path: Path) -> PublishCandidateStageError:
    return PublishCandidateStageError(message, _manifest_payload(result, result_path))


def _evaluation_blocked(candidate: dict[str, Any]) -> bool:
    evaluation_summary = candidate.get("evaluationSummary")
    if isinstance(evaluation_summary, dict) and evaluation_summary.get("passed") is False:
        return True
    return any(_evaluation_blocked(item) for item in _candidate_items(candidate) if item is not candidate)


def _has_successful_callback(result: dict[str, Any], callback_type: str, scope: str | None = None) -> bool:
    for callback in _callback_results(result):
        if callback.get("type") != callback_type:
            continue
        if callback.get("scope") != scope:
            continue
        http_status = _int_or_none(callback.get("httpStatus"))
        response_status = callback.get("responseStatus")
        if http_status is None or http_status < 200 or http_status >= 300:
            continue
        if response_status in SUCCESS_RESPONSE_STATUSES:
            return True
    return False


def _append_callback_result(
    result: dict[str, Any],
    callback_result: dict[str, object],
    scope: str | None = None,
) -> None:
    callback_result["scope"] = scope
    callbacks = _callback_results(result)
    callbacks.append(callback_result)
    result["callbackResults"] = callbacks


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


def _callback_results(result: dict[str, Any]) -> list[dict[str, Any]]:
    callback_results = result.get("callbackResults")
    if not isinstance(callback_results, list):
        return []
    return [callback for callback in callback_results if isinstance(callback, dict)]


def _candidate_items(candidate: dict[str, Any]) -> list[dict[str, Any]]:
    candidates = candidate.get("candidates")
    if candidates is None:
        return [candidate]
    if not isinstance(candidates, list) or not candidates:
        raise PipelineStageError("candidates must be a non-empty JSON array when present.")
    if not all(isinstance(item, dict) for item in candidates):
        raise PipelineStageError("candidates must contain JSON objects.")
    return cast(list[dict[str, Any]], candidates)


def _candidate_scope(candidate: dict[str, Any], index: int) -> str:
    domain_pack_draft = _required_object(candidate, "domainPackDraft")
    pack_key = domain_pack_draft.get("packKey")
    if isinstance(pack_key, str) and pack_key.strip():
        return pack_key.strip()
    consultation_id = candidate.get("consultationId")
    if isinstance(consultation_id, str) and consultation_id.strip():
        return f"consultation_{consultation_id.strip()}"
    return f"candidate_{index}"


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
            raise PipelineStageError(
                f"{context} item has unsupported type {item.get('type')!r}."
            )
        value_field = item.get("value")
        if not isinstance(value_field, str) or not value_field.strip():
            raise PipelineStageError(f"{context} item 'value' must be a non-blank string.")
