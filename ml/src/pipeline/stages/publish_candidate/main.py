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
        candidate_path = _read_candidate_artifact_path(upstream_manifest_path)
        result["candidateArtifactPath"] = str(candidate_path)
        _write_result(result_path, result)

        if runtime_config.callback_enabled:
            _validate_pipeline_job_id(stage_context.pipeline_job_id)

        candidate = load_candidate(candidate_path)
        validate_candidate(candidate)

        if _evaluation_blocked(candidate):
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

        if not runtime_config.callback_enabled:
            result.update(
                {
                    "publishStatus": "SKIPPED",
                    "skipReason": "CALLBACK_DISABLED",
                    "domainPackId": None,
                    "domainPackVersionId": None,
                    "versionNo": None,
                    "failedCallbackType": None,
                    "callbackResults": [],
                    "error": None,
                }
            )
            _write_result(result_path, result)
            return _manifest_payload(result, result_path)

        result["publishStatus"] = "RUNNING"
        result["error"] = None
        result["failedCallbackType"] = None
        _write_result(result_path, result)

        _run_callbacks(candidate, result, result_path, stage_context, runtime_config)
        result["publishStatus"] = "SUCCEEDED"
        result["failedCallbackType"] = None
        result["error"] = None
        _write_result(result_path, result)
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


def build_external_event_id(dag_id: str, run_id: str, callback_type: str) -> str:
    candidate = f"{dag_id}:{run_id}:{callback_type}"
    if len(candidate) <= 255:
        return candidate
    run_hash = hashlib.sha256(run_id.encode("utf-8")).hexdigest()[:16]
    return f"{dag_id}:{run_hash}:{callback_type}"


def load_candidate(candidate_path: Path) -> dict[str, Any]:
    candidate = json.loads(candidate_path.read_text(encoding="utf-8"))
    if not isinstance(candidate, dict):
        raise PipelineStageError(f"Candidate artifact must be a JSON object: {candidate_path}")
    return cast(dict[str, Any], candidate)


def validate_candidate(candidate: dict[str, Any]) -> None:
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

    workflow_draft = _required_object(candidate, "workflowDraft")
    workflow_lists = {key: _optional_list(workflow_draft, key) for key in WORKFLOW_LIST_KEYS}
    if not any(workflow_lists[key] for key in WORKFLOW_LIST_KEYS):
        raise PipelineStageError("workflowDraft must contain at least one draft component.")

    slot_codes = _validate_code_list(workflow_lists["slots"], "slotCode", "workflowDraft.slots")
    _validate_code_list(workflow_lists["policies"], "policyCode", "workflowDraft.policies")
    _validate_code_list(workflow_lists["risks"], "riskCode", "workflowDraft.risks")
    workflow_codes = _validate_code_list(workflow_lists["workflows"], "workflowCode", "workflowDraft.workflows")
    for workflow in workflow_lists["workflows"]:
        _required_non_blank(workflow, "graphJson", 20000)

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


def build_domain_pack_payload(candidate: dict[str, Any], stage_context: StageContext) -> dict[str, object]:
    domain_pack_draft = _required_object(candidate, "domainPackDraft")
    return {
        "externalEventId": build_external_event_id(stage_context.dag_id, stage_context.run_id, CALLBACK_DOMAIN_PACK),
        "packKey": domain_pack_draft["packKey"],
        "packName": domain_pack_draft["packName"],
        "summaryJson": domain_pack_draft.get("summaryJson"),
    }


def build_intent_payload(
    candidate: dict[str, Any], stage_context: StageContext, domain_pack_version_id: int
) -> dict[str, object]:
    intent_draft = _required_object(candidate, "intentDraft")
    return {
        "externalEventId": build_external_event_id(stage_context.dag_id, stage_context.run_id, CALLBACK_INTENT),
        "domainPackVersionId": domain_pack_version_id,
        "intents": copy.deepcopy(intent_draft["intents"]),
    }


def build_workflow_payload(
    candidate: dict[str, Any], stage_context: StageContext, domain_pack_version_id: int
) -> dict[str, object]:
    workflow_draft = _required_object(candidate, "workflowDraft")
    payload: dict[str, object] = {
        "externalEventId": build_external_event_id(stage_context.dag_id, stage_context.run_id, CALLBACK_WORKFLOW),
        "domainPackVersionId": domain_pack_version_id,
    }
    for key in WORKFLOW_LIST_KEYS:
        payload[key] = copy.deepcopy(workflow_draft.get(key) or [])
    return payload


def apply_domain_pack_response(result: dict[str, Any], parsed_response_body: object | None) -> None:
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


def _run_callbacks(
    candidate: dict[str, Any],
    result: dict[str, Any],
    result_path: Path,
    stage_context: StageContext,
    runtime_config: PipelineRuntimeConfig,
) -> None:
    if not _has_successful_callback(result, CALLBACK_DOMAIN_PACK):
        domain_payload = build_domain_pack_payload(candidate, stage_context)
        domain_response = _post_callback(domain_payload, CALLBACK_DOMAIN_PACK, stage_context, runtime_config)
        _append_callback_result(result, domain_response.to_result_entry())
        apply_domain_pack_response(result, domain_response.parsed_response_body)
        _write_result(result_path, result)

    domain_pack_version_id = _int_or_none(result.get("domainPackVersionId"))
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

    if not _has_successful_callback(result, CALLBACK_INTENT):
        intent_payload = build_intent_payload(candidate, stage_context, domain_pack_version_id)
        intent_response = _post_callback(intent_payload, CALLBACK_INTENT, stage_context, runtime_config)
        _append_callback_result(result, intent_response.to_result_entry())
        _write_result(result_path, result)

    if not _has_successful_callback(result, CALLBACK_WORKFLOW):
        workflow_payload = build_workflow_payload(candidate, stage_context, domain_pack_version_id)
        workflow_response = _post_callback(workflow_payload, CALLBACK_WORKFLOW, stage_context, runtime_config)
        _append_callback_result(result, workflow_response.to_result_entry())
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
    return isinstance(evaluation_summary, dict) and evaluation_summary.get("passed") is False


def _has_successful_callback(result: dict[str, Any], callback_type: str) -> bool:
    for callback in _callback_results(result):
        if callback.get("type") != callback_type:
            continue
        http_status = _int_or_none(callback.get("httpStatus"))
        response_status = callback.get("responseStatus")
        if http_status is None or http_status < 200 or http_status >= 300:
            continue
        if response_status in SUCCESS_RESPONSE_STATUSES:
            return True
    return False


def _append_callback_result(result: dict[str, Any], callback_result: dict[str, object]) -> None:
    callbacks = _callback_results(result)
    callbacks.append(callback_result)
    result["callbackResults"] = callbacks


def _callback_results(result: dict[str, Any]) -> list[dict[str, Any]]:
    callback_results = result.get("callbackResults")
    if not isinstance(callback_results, list):
        return []
    return [callback for callback in callback_results if isinstance(callback, dict)]


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
