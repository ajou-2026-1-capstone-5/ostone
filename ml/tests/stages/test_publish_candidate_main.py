from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any, cast

import pytest

from pipeline.common.callbacks import CallbackResponse
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineStageError
from pipeline.stages.publish_candidate import main as publish


def _candidate() -> dict[str, Any]:
    return {
        "schemaVersion": "1.0",
        "domainPackDraft": {
            "packKey": "refund-pack",
            "packName": "Refund Pack",
            "summaryJson": '{"clusterCount":1}',
        },
        "intentDraft": {
            "intents": [
                {
                    "intentCode": "refund_request",
                    "name": "Refund request",
                    "description": "Customer asks for a refund.",
                    "taxonomyLevel": 1,
                    "parentIntentCode": None,
                    "sourceClusterRef": "{}",
                    "entryConditionJson": "{}",
                    "evidenceJson": "[]",
                    "metaJson": "{}",
                }
            ]
        },
        "workflowDraft": {
            "slots": [
                {
                    "slotCode": "order_id",
                    "name": "Order ID",
                    "description": "Target order.",
                    "dataType": "STRING",
                    "isSensitive": False,
                    "validationRuleJson": "{}",
                    "defaultValueJson": None,
                    "metaJson": "{}",
                }
            ],
            "policies": [
                {
                    "policyCode": "refund_policy_default",
                    "name": "Refund policy",
                    "description": "Default refund policy.",
                    "severity": "HIGH",
                    "conditionJson": "{}",
                    "actionJson": "{}",
                    "evidenceJson": "[]",
                    "metaJson": "{}",
                }
            ],
            "risks": [],
            "workflows": [
                {
                    "workflowCode": "refund_flow",
                    "name": "Refund flow",
                    "description": "Refund workflow.",
                    "graphJson": '{"nodes":[],"edges":[]}',
                    "evidenceJson": "[]",
                    "metaJson": "{}",
                }
            ],
            "intentSlotBindings": [
                {
                    "intentCode": "refund_request",
                    "slotCode": "order_id",
                    "isRequired": True,
                    "collectionOrder": 1,
                    "promptHint": "Order ID?",
                    "conditionJson": "{}",
                }
            ],
            "intentWorkflowBindings": [
                {
                    "intentCode": "refund_request",
                    "workflowCode": "refund_flow",
                    "isPrimary": True,
                    "routeConditionJson": "{}",
                }
            ],
        },
        "evaluationSummary": {"passed": True},
    }


def _write_publish_inputs(tmp_path: Path, candidate: dict[str, Any] | None = None) -> tuple[Path, Path]:
    candidate_path = tmp_path / "publish_candidate_input.json"
    candidate_path.write_text(json.dumps(candidate or _candidate()), encoding="utf-8")
    manifest_path = tmp_path / "evaluation_manifest.json"
    manifest_path.write_text(
        json.dumps(
            {
                "dag_id": "domain_pack_generation",
                "run_id": "manual__run",
                "workspace_id": "3",
                "dataset_id": "5",
                "pipeline_job_id": "11",
                "payload": {"candidateArtifactPath": str(candidate_path)},
            }
        ),
        encoding="utf-8",
    )
    return manifest_path, candidate_path


def _stage_context() -> StageContext:
    return StageContext(
        dag_id="domain_pack_generation",
        run_id="manual__run",
        stage_name="publish_candidate",
        workspace_id="3",
        dataset_id="5",
        pipeline_job_id="11",
    )


def test_build_external_event_id_is_stable() -> None:
    first = publish.build_external_event_id("dag", "manual__run", "domain-pack-drafts")
    second = publish.build_external_event_id("dag", "manual__run", "domain-pack-drafts")

    assert first == second
    assert first == "dag:manual__run:domain-pack-drafts"


def test_load_candidate_requires_schema_version() -> None:
    candidate = _candidate()
    candidate["schemaVersion"] = "2.0"

    with pytest.raises(PipelineStageError):
        publish.validate_candidate(candidate)


def test_validate_candidate_requires_intents() -> None:
    candidate = _candidate()
    candidate["intentDraft"]["intents"] = []

    with pytest.raises(PipelineStageError):
        publish.validate_candidate(candidate)


def test_validate_candidate_requires_workflow_component() -> None:
    candidate = _candidate()
    candidate["workflowDraft"] = {key: [] for key in publish.WORKFLOW_LIST_KEYS}

    with pytest.raises(PipelineStageError):
        publish.validate_candidate(candidate)


def test_validate_candidate_rejects_missing_spring_required_fields() -> None:
    cases = [
        ("intent name", ("intentDraft", "intents", 0, "name")),
        ("slot name", ("workflowDraft", "slots", 0, "name")),
        ("slot dataType", ("workflowDraft", "slots", 0, "dataType")),
        ("policy name", ("workflowDraft", "policies", 0, "name")),
        ("risk name", ("workflowDraft", "risks", 0, "name")),
        ("risk riskLevel", ("workflowDraft", "risks", 0, "riskLevel")),
        ("workflow name", ("workflowDraft", "workflows", 0, "name")),
    ]

    for _label, path in cases:
        candidate = _candidate()
        candidate["workflowDraft"]["risks"] = [{"riskCode": "refund_risk", "name": "Refund risk", "riskLevel": "HIGH"}]
        target: Any = candidate
        for segment in path[:-1]:
            target = target[segment]
        target[path[-1]] = ""

        with pytest.raises(PipelineStageError):
            publish.validate_candidate(copy.deepcopy(candidate))


def test_domain_pack_response_updates_context() -> None:
    result: dict[str, Any] = {}

    publish.apply_domain_pack_response(
        result,
        {
            "status": "CREATED",
            "domainPackId": 7,
            "domainPackVersionId": 101,
            "versionNo": 3,
        },
    )

    assert result["domainPackId"] == 7
    assert result["domainPackVersionId"] == 101
    assert result["versionNo"] == 3


def test_intent_payload_includes_domain_pack_version_id() -> None:
    payload = publish.build_intent_payload(_candidate(), _stage_context(), 101)

    assert payload["domainPackVersionId"] == 101
    assert payload["externalEventId"] == "domain_pack_generation:manual__run:intent-drafts"


def test_workflow_payload_includes_domain_pack_version_id() -> None:
    payload = publish.build_workflow_payload(_candidate(), _stage_context(), 101)

    assert payload["domainPackVersionId"] == 101
    assert payload["externalEventId"] == "domain_pack_generation:manual__run:workflow-drafts"


def test_retry_reuses_existing_domain_pack_context(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    manifest_path, _candidate_path = _write_publish_inputs(tmp_path)
    artifact_root = tmp_path / "artifacts"
    result_dir = artifact_root / "domain_pack_generation" / "manual__run" / "publish_candidate"
    result_dir.mkdir(parents=True)
    (result_dir / "publish_candidate_result.json").write_text(
        json.dumps(
            {
                "schemaVersion": "1.0",
                "publishStatus": "RUNNING",
                "pipelineContext": {
                    "dagId": "domain_pack_generation",
                    "runId": "manual__run",
                    "pipelineJobId": "11",
                    "workspaceId": "3",
                    "datasetId": "5",
                },
                "candidateArtifactPath": str(_candidate_path),
                "domainPackId": 7,
                "domainPackVersionId": 101,
                "versionNo": 3,
                "failedCallbackType": None,
                "callbackResults": [
                    {
                        "type": "domain-pack-drafts",
                        "externalEventId": "domain_pack_generation:manual__run:domain-pack-drafts",
                        "endpoint": "/domain",
                        "httpStatus": 201,
                        "responseStatus": "CREATED",
                    }
                ],
                "error": None,
            }
        ),
        encoding="utf-8",
    )
    calls: list[str] = []

    def fake_post_callback(
        _backend_base_url: str,
        _job_id: str,
        callback_type: str,
        payload: dict[str, object],
        _webhook_secret: str,
        _timeout_seconds: float,
    ) -> CallbackResponse:
        calls.append(callback_type)
        return CallbackResponse(
            callback_type=callback_type,
            external_event_id=cast(str, payload["externalEventId"]),
            endpoint=f"/{callback_type}",
            http_status=201,
            response_status="CREATED",
            response_body='{"status":"CREATED"}',
            response_body_truncated=False,
            parsed_response_body={"status": "CREATED", "domainPackVersionId": 101},
        )

    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    monkeypatch.setattr(publish, "post_callback", fake_post_callback)

    publish.run(str(manifest_path))

    assert calls == ["intent-drafts", "workflow-drafts"]


def test_domain_pack_timeout_without_context_is_non_retryable(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    manifest_path, _candidate_path = _write_publish_inputs(tmp_path)
    artifact_root = tmp_path / "artifacts"

    def fake_post_callback(
        _backend_base_url: str,
        _job_id: str,
        callback_type: str,
        payload: dict[str, object],
        _webhook_secret: str,
        _timeout_seconds: float,
    ) -> CallbackResponse:
        return CallbackResponse(
            callback_type=callback_type,
            external_event_id=cast(str, payload["externalEventId"]),
            endpoint=f"/{callback_type}",
            http_status=200,
            response_status="DUPLICATE_IGNORED",
            response_body='{"status":"DUPLICATE_IGNORED"}',
            response_body_truncated=False,
            parsed_response_body={"status": "DUPLICATE_IGNORED"},
        )

    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    monkeypatch.setattr(publish, "post_callback", fake_post_callback)

    with pytest.raises(publish.PublishCandidateStageError):
        publish.run(str(manifest_path))

    result_path = (
        artifact_root / "domain_pack_generation" / "manual__run" / "publish_candidate" / "publish_candidate_result.json"
    )
    result = json.loads(result_path.read_text(encoding="utf-8"))
    assert result["publishStatus"] == "FAILED"
    assert result["failedCallbackType"] == "domain-pack-drafts"
    assert result["error"]["type"] == "DomainPackContextLost"


def test_unexpected_callback_status_fails_before_next_callback(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    manifest_path, _candidate_path = _write_publish_inputs(tmp_path)
    artifact_root = tmp_path / "artifacts"
    calls: list[str] = []

    def fake_post_callback(
        _backend_base_url: str,
        _job_id: str,
        callback_type: str,
        payload: dict[str, object],
        _webhook_secret: str,
        _timeout_seconds: float,
    ) -> CallbackResponse:
        calls.append(callback_type)
        parsed_body: dict[str, object] = {"status": "WEIRD"}
        if callback_type == "domain-pack-drafts":
            parsed_body["domainPackVersionId"] = 101
        return CallbackResponse(
            callback_type=callback_type,
            external_event_id=cast(str, payload["externalEventId"]),
            endpoint=f"/{callback_type}",
            http_status=200,
            response_status="WEIRD",
            response_body='{"status":"WEIRD"}',
            response_body_truncated=False,
            parsed_response_body=parsed_body,
        )

    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    monkeypatch.setattr(publish, "post_callback", fake_post_callback)

    with pytest.raises(publish.PublishCandidateStageError):
        publish.run(str(manifest_path))

    result_path = (
        artifact_root / "domain_pack_generation" / "manual__run" / "publish_candidate" / "publish_candidate_result.json"
    )
    result = json.loads(result_path.read_text(encoding="utf-8"))
    assert calls == ["domain-pack-drafts"]
    assert result["publishStatus"] == "FAILED"
    assert result["failedCallbackType"] == "domain-pack-drafts"
    assert result["error"]["parsedResponseBody"] == {"status": "WEIRD", "domainPackVersionId": 101}


def test_evaluation_blocked_fails_airflow_task(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    candidate = _candidate()
    candidate["evaluationSummary"] = {"passed": False}
    manifest_path, _candidate_path = _write_publish_inputs(tmp_path, candidate)
    artifact_root = tmp_path / "artifacts"
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")

    with pytest.raises(publish.PublishCandidateStageError):
        publish.run(str(manifest_path))

    result_path = (
        artifact_root / "domain_pack_generation" / "manual__run" / "publish_candidate" / "publish_candidate_result.json"
    )
    result = json.loads(result_path.read_text(encoding="utf-8"))
    assert result["publishStatus"] == "BLOCKED_BY_EVALUATION"
    assert result["callbackResults"] == []


def test_callback_disabled_writes_skipped_result(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    manifest_path, _candidate_path = _write_publish_inputs(tmp_path)
    artifact_root = tmp_path / "artifacts"
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    monkeypatch.setenv("PIPELINE_CALLBACK_ENABLED", "false")

    payload = publish.run(str(manifest_path))

    assert payload["publish_status"] == "SKIPPED"
    result_path = Path(cast(str, payload["publish_result_path"]))
    result = json.loads(result_path.read_text(encoding="utf-8"))
    assert result["publishStatus"] == "SKIPPED"
    assert result["callbackResults"] == []
