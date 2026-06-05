from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, cast

from pipeline.common.callbacks import CallbackResponse
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineStageError

SUCCESS_RESPONSE_STATUSES = {"CREATED", "DUPLICATE_IGNORED", "OK", "SUCCEEDED"}


class DomainPackContextLost(PipelineStageError):
    pass


@dataclass
class CallbackResult:
    type: str
    external_event_id: str | None
    endpoint: str | None
    http_status: int | None
    response_status: str | None
    response_body: str | None = None
    response_body_truncated: bool = False
    parsed_response_body: object | None = None
    scope: str | None = None

    @classmethod
    def from_response(cls, response: CallbackResponse, scope: str | None) -> CallbackResult:
        return cls(
            type=response.callback_type,
            external_event_id=response.external_event_id,
            endpoint=response.endpoint,
            http_status=response.http_status,
            response_status=response.response_status,
            response_body=response.response_body,
            response_body_truncated=response.response_body_truncated,
            parsed_response_body=response.parsed_response_body,
            scope=scope,
        )

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> CallbackResult:
        return cls(
            type=str(payload.get("type")),
            external_event_id=_optional_str(payload.get("externalEventId")),
            endpoint=_optional_str(payload.get("endpoint")),
            http_status=_int_or_none(payload.get("httpStatus")),
            response_status=_optional_str(payload.get("responseStatus")),
            response_body=_optional_str(payload.get("responseBody")),
            response_body_truncated=bool(payload.get("responseBodyTruncated", False)),
            parsed_response_body=payload.get("parsedResponseBody"),
            scope=_optional_str(payload.get("scope")),
        )

    def to_payload(self) -> dict[str, object]:
        return {
            "type": self.type,
            "externalEventId": self.external_event_id,
            "endpoint": self.endpoint,
            "httpStatus": self.http_status,
            "responseStatus": self.response_status,
            "responseBody": self.response_body,
            "responseBodyTruncated": self.response_body_truncated,
            "parsedResponseBody": self.parsed_response_body,
            "scope": self.scope,
        }

    def to_manifest_entry(self) -> dict[str, object]:
        return {
            "type": self.type,
            "scope": self.scope,
            "external_event_id": self.external_event_id,
            "http_status": self.http_status,
            "response_status": self.response_status,
        }

    def is_successful(self, callback_type: str, scope: str | None) -> bool:
        if self.type != callback_type or self.scope != scope:
            return False
        if self.http_status is None or self.http_status < 200 or self.http_status >= 300:
            return False
        return self.response_status in SUCCESS_RESPONSE_STATUSES


@dataclass
class DomainPackContext:
    domain_pack_id: int | None
    domain_pack_version_id: int | None
    version_no: int | None

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> DomainPackContext:
        return cls(
            domain_pack_id=_int_or_none(payload.get("domainPackId")),
            domain_pack_version_id=_int_or_none(payload.get("domainPackVersionId")),
            version_no=_int_or_none(payload.get("versionNo")),
        )

    def to_payload(self) -> dict[str, object]:
        return {
            "domainPackId": self.domain_pack_id,
            "domainPackVersionId": self.domain_pack_version_id,
            "versionNo": self.version_no,
        }


@dataclass
class PublishCandidateResult:
    schema_version: str
    publish_status: str
    pipeline_context: dict[str, object]
    candidate_artifact_path: str | None = None
    domain_pack_id: int | None = None
    domain_pack_version_id: int | None = None
    version_no: int | None = None
    candidate_count: int = 0
    domain_pack_contexts: dict[str, DomainPackContext] = field(default_factory=dict)
    failed_callback_type: str | None = None
    callback_results: list[CallbackResult] = field(default_factory=list)
    error: dict[str, object] | None = None
    evaluation_gate_status: str | None = None
    evaluation_gate_reason: str | None = None
    skip_reason: str | None = None
    extra_fields: dict[str, object] = field(default_factory=dict)

    @classmethod
    def initial(cls, stage_context: StageContext, schema_version: str) -> PublishCandidateResult:
        return cls(
            schema_version=schema_version,
            publish_status="PENDING",
            pipeline_context={
                "dagId": stage_context.dag_id,
                "runId": stage_context.run_id,
                "pipelineJobId": stage_context.pipeline_job_id,
                "workspaceId": stage_context.workspace_id,
                "datasetId": stage_context.dataset_id,
            },
            domain_pack_contexts={},
        )

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> PublishCandidateResult:
        callback_results = payload.get("callbackResults")
        domain_pack_contexts = payload.get("domainPackContexts")
        pipeline_context = payload.get("pipelineContext")
        known_keys = {
            "schemaVersion",
            "publishStatus",
            "pipelineContext",
            "candidateArtifactPath",
            "domainPackId",
            "domainPackVersionId",
            "versionNo",
            "candidateCount",
            "domainPackContexts",
            "failedCallbackType",
            "callbackResults",
            "error",
            "evaluationGateStatus",
            "evaluationGateReason",
            "skipReason",
        }
        return cls(
            schema_version=str(payload.get("schemaVersion", "1.0")),
            publish_status=str(payload.get("publishStatus", "PENDING")),
            pipeline_context=cast(dict[str, object], pipeline_context) if isinstance(pipeline_context, dict) else {},
            candidate_artifact_path=_optional_str(payload.get("candidateArtifactPath")),
            domain_pack_id=_int_or_none(payload.get("domainPackId")),
            domain_pack_version_id=_int_or_none(payload.get("domainPackVersionId")),
            version_no=_int_or_none(payload.get("versionNo")),
            candidate_count=_int_or_none(payload.get("candidateCount")) or 0,
            domain_pack_contexts=_parse_domain_pack_contexts(domain_pack_contexts),
            failed_callback_type=_optional_str(payload.get("failedCallbackType")),
            callback_results=_parse_callback_results(callback_results),
            error=cast(dict[str, object], payload.get("error")) if isinstance(payload.get("error"), dict) else None,
            evaluation_gate_status=_optional_str(payload.get("evaluationGateStatus")),
            evaluation_gate_reason=_optional_str(payload.get("evaluationGateReason")),
            skip_reason=_optional_str(payload.get("skipReason")),
            extra_fields={key: value for key, value in payload.items() if key not in known_keys},
        )

    def to_payload(self) -> dict[str, object]:
        payload: dict[str, object] = {
            "schemaVersion": self.schema_version,
            "publishStatus": self.publish_status,
            "pipelineContext": self.pipeline_context,
            "candidateArtifactPath": self.candidate_artifact_path,
            "domainPackId": self.domain_pack_id,
            "domainPackVersionId": self.domain_pack_version_id,
            "versionNo": self.version_no,
            "candidateCount": self.candidate_count,
            "domainPackContexts": {scope: context.to_payload() for scope, context in self.domain_pack_contexts.items()},
            "failedCallbackType": self.failed_callback_type,
            "callbackResults": [callback.to_payload() for callback in self.callback_results],
            "error": self.error,
        }
        if self.evaluation_gate_status is not None:
            payload["evaluationGateStatus"] = self.evaluation_gate_status
        if self.evaluation_gate_reason is not None:
            payload["evaluationGateReason"] = self.evaluation_gate_reason
        if self.skip_reason is not None:
            payload["skipReason"] = self.skip_reason
        payload.update(self.extra_fields)
        return payload

    def set_candidate_artifact_path(self, candidate_path: Path) -> None:
        self.candidate_artifact_path = str(candidate_path)

    def mark_evaluation_needs_human_review(self) -> None:
        self.evaluation_gate_status = "NEEDS_HUMAN_REVIEW"
        self.evaluation_gate_reason = "evaluationSummary.passed=false"

    def mark_skipped(self, candidate_count: int) -> None:
        self.publish_status = "SKIPPED"
        self.skip_reason = "CALLBACK_DISABLED"
        self.domain_pack_id = None
        self.domain_pack_version_id = None
        self.version_no = None
        self.candidate_count = candidate_count
        self.domain_pack_contexts = {}
        self.failed_callback_type = None
        self.callback_results = []
        self.error = None

    def mark_running(self) -> None:
        self.publish_status = "RUNNING"
        self.error = None
        self.failed_callback_type = None

    def mark_succeeded(self) -> None:
        self.publish_status = "SUCCEEDED"
        self.failed_callback_type = None
        self.error = None

    def mark_failed(self, failed_callback_type: str | None, error: dict[str, object]) -> None:
        self.publish_status = "FAILED"
        self.failed_callback_type = failed_callback_type
        self.error = error

    def append_callback_response(self, response: CallbackResponse, scope: str | None) -> None:
        self.callback_results.append(CallbackResult.from_response(response, scope))

    def has_successful_callback(self, callback_type: str, scope: str | None = None) -> bool:
        return any(callback.is_successful(callback_type, scope) for callback in self.callback_results)

    def apply_domain_pack_response(self, parsed_response_body: object | None, scope: str | None = None) -> None:
        if not isinstance(parsed_response_body, dict):
            raise DomainPackContextLost("domain-pack-drafts response body must be a JSON object.")

        domain_pack_id = _int_or_none(parsed_response_body.get("domainPackId"))
        domain_pack_version_id = _int_or_none(parsed_response_body.get("domainPackVersionId"))
        version_no = _int_or_none(parsed_response_body.get("versionNo"))
        if domain_pack_version_id is None:
            raise DomainPackContextLost("domain-pack-drafts response did not include domainPackVersionId.")

        self.domain_pack_id = domain_pack_id
        self.domain_pack_version_id = domain_pack_version_id
        self.version_no = version_no
        if scope is not None:
            self.domain_pack_contexts[scope] = DomainPackContext(
                domain_pack_id=domain_pack_id,
                domain_pack_version_id=domain_pack_version_id,
                version_no=version_no,
            )

    def domain_pack_version_id_for(self, scope: str | None) -> int | None:
        if scope is None:
            return self.domain_pack_version_id
        context = self.domain_pack_contexts.get(scope)
        if context is not None:
            return context.domain_pack_version_id
        for callback in reversed(self.callback_results):
            if callback.type != "domain-pack-drafts" or callback.scope != scope:
                continue
            parsed = callback.parsed_response_body
            if isinstance(parsed, dict):
                return _int_or_none(parsed.get("domainPackVersionId"))
        return None

    def manifest_payload(self, result_path: Path) -> dict[str, object]:
        return {
            "status": self.manifest_status(),
            "candidate_artifact_path": self.candidate_artifact_path,
            "publish_result_path": str(result_path.resolve()),
            "domain_pack_id": self.domain_pack_id,
            "domain_pack_version_id": self.domain_pack_version_id,
            "domain_pack_contexts": {
                scope: context.to_payload() for scope, context in self.domain_pack_contexts.items()
            },
            "candidate_count": self.candidate_count,
            "version_no": self.version_no,
            "callbacks": [callback.to_manifest_entry() for callback in self.callback_results],
            "failed_callback_type": self.failed_callback_type,
            "publish_status": self.publish_status,
        }

    def manifest_status(self) -> str:
        if self.publish_status == "SUCCEEDED":
            return "completed"
        if self.publish_status == "FAILED":
            return "failed"
        return self.publish_status.lower()


@dataclass(frozen=True)
class PublishCandidateResultWriter:
    path: Path

    def load(self) -> PublishCandidateResult | None:
        if not self.path.exists():
            return None
        result = json.loads(self.path.read_text(encoding="utf-8"))
        if not isinstance(result, dict):
            raise PipelineStageError(f"Existing publish result must be a JSON object: {self.path}")
        return PublishCandidateResult.from_payload(result)

    def write(self, result: PublishCandidateResult) -> None:
        self.path.write_text(json.dumps(result.to_payload(), indent=2, ensure_ascii=False), encoding="utf-8")


def _parse_callback_results(value: object) -> list[CallbackResult]:
    if not isinstance(value, list):
        return []
    return [CallbackResult.from_payload(callback) for callback in value if isinstance(callback, dict)]


def _parse_domain_pack_contexts(value: object) -> dict[str, DomainPackContext]:
    if not isinstance(value, dict):
        return {}
    return {
        str(scope): DomainPackContext.from_payload(context)
        for scope, context in value.items()
        if isinstance(context, dict)
    }


def _optional_str(value: object) -> str | None:
    return value if isinstance(value, str) else None


def _int_or_none(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdecimal():
        return int(value)
    return None
