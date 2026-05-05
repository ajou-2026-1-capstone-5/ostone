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
                    "representativeCases": [
                        {
                            "conversationId": "conv_001",
                            "canonicalText": "환불 요청합니다",
                            "customerProblemText": "환불",
                            "endedStatus": "resolved",
                        }
                    ],
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


def test_build_external_event_id_falls_back_to_bounded_token_for_long_inputs() -> None:
    first = publish.build_external_event_id("d" * 260, "r" * 260, "domain-pack-drafts")
    second = publish.build_external_event_id("d" * 260, "r" * 260, "domain-pack-drafts")
    other_type = publish.build_external_event_id("d" * 260, "r" * 260, "intent-drafts")

    assert first == second
    assert first.startswith("airflow:domain-pack-drafts:")
    assert len(first) <= 255
    assert first != other_type


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


def _candidate_with_cases(cases: list[dict[str, Any]]) -> dict[str, Any]:
    candidate = _candidate()
    candidate["intentDraft"]["intents"][0]["representativeCases"] = cases
    return candidate


def _valid_case(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "conversationId": "conv_001",
        "canonicalText": "환불 요청합니다",
        "customerProblemText": "환불",
        "endedStatus": "resolved",
    }
    base.update(overrides)
    return base


def test_validate_candidate_passes_with_empty_representative_cases() -> None:
    candidate = _candidate_with_cases([])
    publish.validate_candidate(candidate)


def test_validate_candidate_passes_with_null_ended_status() -> None:
    candidate = _candidate_with_cases([_valid_case(endedStatus=None)])
    publish.validate_candidate(candidate)


def test_vrc1_representative_cases_must_be_array() -> None:
    candidate = _candidate()
    candidate["intentDraft"]["intents"][0]["representativeCases"] = "not-a-list"

    with pytest.raises(PipelineStageError, match="must be a JSON array"):
        publish.validate_candidate(candidate)


def test_vrc1_representative_cases_missing_key() -> None:
    candidate = _candidate()
    del candidate["intentDraft"]["intents"][0]["representativeCases"]

    with pytest.raises(PipelineStageError, match="must be a JSON array"):
        publish.validate_candidate(candidate)


def test_vrc2_representative_cases_max_three() -> None:
    cases = [_valid_case(conversationId=f"conv_{i:03d}") for i in range(4)]
    candidate = _candidate_with_cases(cases)

    with pytest.raises(PipelineStageError, match="at most 3 items"):
        publish.validate_candidate(candidate)


def test_vrc3_conversation_id_must_be_non_blank() -> None:
    candidate = _candidate_with_cases([_valid_case(conversationId="")])

    with pytest.raises(PipelineStageError, match="conversationId must be a non-blank string"):
        publish.validate_candidate(candidate)


def test_vrc3_conversation_id_max_100_chars() -> None:
    candidate = _candidate_with_cases([_valid_case(conversationId="x" * 101)])

    with pytest.raises(PipelineStageError, match="conversationId must be a non-blank string up to 100 chars"):
        publish.validate_candidate(candidate)


def test_vrc4_canonical_text_must_be_non_blank() -> None:
    candidate = _candidate_with_cases([_valid_case(canonicalText="")])

    with pytest.raises(PipelineStageError, match="canonicalText must be a non-blank string"):
        publish.validate_candidate(candidate)


def test_vrc5_customer_problem_text_must_be_non_blank() -> None:
    candidate = _candidate_with_cases([_valid_case(customerProblemText="   ")])

    with pytest.raises(PipelineStageError, match="customerProblemText must be a non-blank string"):
        publish.validate_candidate(candidate)


def test_vrc6_ended_status_must_be_string_or_null() -> None:
    candidate = _candidate_with_cases([_valid_case(endedStatus=123)])

    with pytest.raises(PipelineStageError, match="endedStatus must be a string or null"):
        publish.validate_candidate(candidate)


def test_vrc7_no_duplicate_conversation_ids_within_intent() -> None:
    cases = [_valid_case(conversationId="conv_001"), _valid_case(conversationId="conv_001")]
    candidate = _candidate_with_cases(cases)

    with pytest.raises(PipelineStageError, match="duplicates within an intent"):
        publish.validate_candidate(candidate)


# ---------------------------------------------------------------------------
# validate_candidate — workflow evidenceJson
# ---------------------------------------------------------------------------


def _candidate_with_workflow_evidence(evidence_json: object) -> dict[str, Any]:
    candidate = _candidate()
    candidate["workflowDraft"]["workflows"][0]["evidenceJson"] = evidence_json  # type: ignore[index]
    return candidate


def test_workflow_evidence_json_valid_array_passes() -> None:
    candidate = _candidate_with_workflow_evidence(
        '[{"type":"keyword","value":"환불"},{"type":"exemplar_conv_id","value":"conv-1"}]'
    )
    publish.validate_candidate(candidate)


def test_workflow_evidence_json_none_passes() -> None:
    candidate = _candidate_with_workflow_evidence(None)
    publish.validate_candidate(candidate)


def test_workflow_evidence_json_missing_key_passes() -> None:
    candidate = _candidate()
    del candidate["workflowDraft"]["workflows"][0]["evidenceJson"]  # type: ignore[attr-defined]
    publish.validate_candidate(candidate)


def test_workflow_evidence_json_empty_string_fails() -> None:
    candidate = _candidate_with_workflow_evidence("")
    with pytest.raises(PipelineStageError, match="must be valid JSON"):
        publish.validate_candidate(candidate)


def test_workflow_evidence_json_json_object_fails() -> None:
    candidate = _candidate_with_workflow_evidence("{}")
    with pytest.raises(PipelineStageError, match="must encode a JSON array"):
        publish.validate_candidate(candidate)


def test_workflow_evidence_json_not_json_fails() -> None:
    candidate = _candidate_with_workflow_evidence("not-json")
    with pytest.raises(PipelineStageError, match="must be valid JSON"):
        publish.validate_candidate(candidate)


def test_workflow_evidence_json_exceeds_5000_chars_fails() -> None:
    long_value = "x" * 5001
    candidate = _candidate_with_workflow_evidence(long_value)
    with pytest.raises(PipelineStageError, match="exceeds 5000"):
        publish.validate_candidate(candidate)


def test_workflow_evidence_json_int_type_fails() -> None:
    candidate = _candidate_with_workflow_evidence(123)
    with pytest.raises(PipelineStageError, match="must be a string when present"):
        publish.validate_candidate(candidate)


def test_policy_evidence_json_not_validated() -> None:
    candidate = _candidate()
    candidate["workflowDraft"]["policies"][0]["evidenceJson"] = "not-valid-json"  # type: ignore[index]
    publish.validate_candidate(candidate)
