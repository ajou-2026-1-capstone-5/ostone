from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import httpx

from pipeline.common.config import PipelineRuntimeConfig
from pipeline.stages.draft_generation import description_enrichment
from pipeline.stages.draft_generation.description_enrichment import enrich_candidate_descriptions


def test_description_enrichment_falls_back_without_runtime_url_by_default(tmp_path: Path) -> None:
    summary = enrich_candidate_descriptions(
        _candidate(),
        PipelineRuntimeConfig(
            artifact_root=tmp_path,
            backend_base_url="http://backend:8080",
            llm_runtime_base_url=None,
            llm_model_name="gemma-local",
        ),
    )

    assert summary is not None
    assert summary["enabled"] is True
    assert summary["mode"] == "always_on"
    assert summary["requestFailureCount"] == 1
    assert summary["fallbackReason"] == "missing_llm_runtime_base_url"


def test_description_enrichment_applies_valid_local_llm_response(monkeypatch, tmp_path: Path) -> None:
    fake_client = _RecordingClient([_name_response("결제 금액 확인"), _response(abstain=False)])
    monkeypatch.setattr(description_enrichment.httpx, "Client", _recording_client_factory(fake_client))
    candidate = _candidate()
    runtime_config = _runtime_config(tmp_path)

    summary = enrich_candidate_descriptions(candidate, runtime_config)

    assert summary is not None
    assert summary["schemaTotalCount"] == 2
    assert summary["schemaValidCount"] == 2
    assert summary["schemaFailureCount"] == 0
    assert summary["appliedCount"] == 2
    assert candidate["intentDraft"]["intents"][0]["name"] == "결제 금액 확인"
    assert (
        candidate["intentDraft"]["intents"][0]["description"]
        == "고객의 결제 금액 문의를 확인하고 처리 기준을 안내합니다."
    )
    assert json.loads(candidate["intentDraft"]["intents"][0]["descriptionEnrichmentJson"])["model"] == "gemma-local"


def test_name_enrichment_applies_valid_local_llm_response(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("ML_DESCRIPTION_ENRICHMENT_LIMIT", "1")
    monkeypatch.setattr(description_enrichment.httpx, "Client", _fake_client_factory(_name_response("결제 금액 확인")))
    candidate = _candidate()

    summary = enrich_candidate_descriptions(candidate, _runtime_config(tmp_path))

    assert summary is not None
    assert summary["schemaTotalCount"] == 1
    assert summary["nameTotalCount"] == 1
    assert summary["nameAppliedCount"] == 1
    assert summary["descriptionTotalCount"] == 0
    assert candidate["intentDraft"]["intents"][0]["name"] == "결제 금액 확인"
    enrichment = json.loads(candidate["intentDraft"]["intents"][0]["nameEnrichmentJson"])
    assert enrichment["previousName"] == "결제 금액 문의"
    assert enrichment["usedEvidenceIds"] == ["c1"]


def test_name_enrichment_normalizes_list_style_and_rejects_duplicate_names(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("ML_DESCRIPTION_ENRICHMENT_LIMIT", "3")
    fake_client = _RecordingClient(
        [
            _name_response("결제 / 금액 문의"),
            _name_response("결제 금액 확인"),
            _name_response("결제 금액 확인"),
        ]
    )
    monkeypatch.setattr(description_enrichment.httpx, "Client", _recording_client_factory(fake_client))
    candidate = _candidate_with_duplicate_intents()

    summary = enrich_candidate_descriptions(candidate, _runtime_config(tmp_path))

    assert summary is not None
    assert summary["nameTotalCount"] == 3
    assert summary["nameAppliedCount"] == 2
    assert summary["nameFallbackCount"] == 1
    assert summary["contentValidationFailureCount"] == 1
    intents = candidate["intentDraft"]["intents"]
    assert intents[0]["name"] == "결제 및 금액 문의"
    assert intents[1]["name"] == "결제 금액 확인"
    assert intents[2]["name"] == "결제 한도 문의"


def test_name_enrichment_repairs_rough_current_name_when_llm_name_is_rejected(
    monkeypatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("ML_DESCRIPTION_ENRICHMENT_LIMIT", "2")
    fake_client = _RecordingClient(
        [
            _name_response("결제 금액 확인"),
            {
                "name": "결제 금액과 이용 관련 문의의 본인 확인 및 결제 확인 처리",
                "usedEvidenceIds": ["workflow-graph"],
                "abstain": False,
            },
        ]
    )
    monkeypatch.setattr(description_enrichment.httpx, "Client", _recording_client_factory(fake_client))
    candidate = _candidate_with_rough_workflow_name()

    summary = enrich_candidate_descriptions(candidate, _runtime_config(tmp_path))

    assert summary is not None
    assert summary["nameAppliedCount"] == 1
    assert summary["nameRepairAppliedCount"] == 1
    assert summary["nameFallbackCount"] == 0
    workflow = candidate["workflowDraft"]["workflows"][0]
    assert workflow["name"] == "결제 금액 및 이용 문의 본인 확인 결제 확인"
    enrichment = json.loads(workflow["nameEnrichmentJson"])
    assert enrichment["provider"] == "deterministic_name_repair"
    assert enrichment["llmRejectionReason"] == "name_too_long"


def test_description_enrichment_keeps_original_description_when_model_abstains(
    monkeypatch,
    tmp_path: Path,
) -> None:
    fake_client = _RecordingClient([_name_response("결제 금액 확인"), _response(abstain=True)])
    monkeypatch.setattr(description_enrichment.httpx, "Client", _recording_client_factory(fake_client))
    candidate = _candidate()

    summary = enrich_candidate_descriptions(candidate, _runtime_config(tmp_path))

    assert summary is not None
    assert summary["schemaValidCount"] == 2
    assert summary["abstainCount"] == 1
    assert summary["fallbackCount"] == 1
    assert summary["appliedCount"] == 1
    assert candidate["intentDraft"]["intents"][0]["description"] == "결제 문의 클러스터"


def test_description_enrichment_rejects_unknown_evidence_ids(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(
        description_enrichment.httpx,
        "Client",
        _recording_client_factory(
            _RecordingClient(
                [
                    _name_response("결제 금액 확인"),
                    {
                        "description": "고객의 결제 금액 문의를 확인하고 처리 기준을 안내합니다.",
                        "usedEvidenceIds": ["unknown"],
                        "abstain": False,
                    },
                ]
            )
        ),
    )
    candidate = _candidate()

    summary = enrich_candidate_descriptions(candidate, _runtime_config(tmp_path))

    assert summary is not None
    assert summary["schemaValidCount"] == 2
    assert summary["schemaFailureCount"] == 0
    assert summary["evidenceMismatchCount"] == 1
    assert summary["fallbackCount"] == 1
    assert candidate["intentDraft"]["intents"][0]["description"] == "결제 문의 클러스터"


def test_description_enrichment_rejects_meta_generation_phrases(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(
        description_enrichment.httpx,
        "Client",
        _recording_client_factory(
            _RecordingClient(
                [
                    _name_response("결제 금액 확인"),
                    {
                        "description": "결제 문의를 처리하는 자동 생성 워크플로우입니다.",
                        "usedEvidenceIds": ["c1"],
                        "abstain": False,
                    },
                ]
            )
        ),
    )
    candidate = _candidate()

    summary = enrich_candidate_descriptions(candidate, _runtime_config(tmp_path))

    assert summary is not None
    assert summary["schemaValidCount"] == 2
    assert summary["contentValidationFailureCount"] == 1
    assert summary["fallbackCount"] == 1
    assert candidate["intentDraft"]["intents"][0]["description"] == "결제 문의 클러스터"


def test_description_enrichment_reports_missing_runtime_url(tmp_path: Path) -> None:
    runtime_config = PipelineRuntimeConfig(
        artifact_root=tmp_path,
        backend_base_url="http://backend:8080",
        llm_runtime_base_url=None,
        llm_model_name="gemma-local",
    )

    summary = enrich_candidate_descriptions(_candidate(), runtime_config)

    assert summary is not None
    assert summary["requestFailureCount"] == 1
    assert summary["fallbackReason"] == "missing_llm_runtime_base_url"


def test_description_enrichment_respects_limit_and_api_key(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("ML_DESCRIPTION_ENRICHMENT_LIMIT", "1")
    fake_client = _RecordingClient([_name_response("결제 금액 확인")])
    monkeypatch.setattr(description_enrichment.httpx, "Client", _recording_client_factory(fake_client))
    candidate = _candidate_with_workflow()
    runtime_config = _runtime_config(tmp_path, api_key="secret")

    summary = enrich_candidate_descriptions(candidate, runtime_config)

    assert summary is not None
    assert summary["schemaTotalCount"] == 1
    assert summary["appliedCount"] == 1
    assert len(fake_client.requests) == 1
    assert fake_client.requests[0]["headers"]["Authorization"] == "Bearer secret"


def test_description_enrichment_sends_model_options_by_default(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("ML_DESCRIPTION_ENRICHMENT_LIMIT", "1")
    fake_client = _RecordingClient([_name_response("카드 한도 상향")])
    monkeypatch.setattr(description_enrichment.httpx, "Client", _recording_client_factory(fake_client))

    summary = enrich_candidate_descriptions(_candidate(), _runtime_config(tmp_path))

    assert summary is not None
    assert summary["nameAppliedCount"] == 1
    assert fake_client.requests[0]["json"]["options"] == {"think": False}


def test_description_enrichment_handles_request_failure(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(
        description_enrichment.httpx,
        "Client",
        _fake_client_factory(httpx.ConnectError("connection failed")),
    )
    candidate = _candidate()

    summary = enrich_candidate_descriptions(candidate, _runtime_config(tmp_path), logger=logging.getLogger(__name__))

    assert summary is not None
    assert summary["requestFailureCount"] == 2
    assert summary["fallbackCount"] == 2
    assert candidate["intentDraft"]["intents"][0]["description"] == "결제 문의 클러스터"


def test_description_enrichment_counts_schema_failures(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(
        description_enrichment.httpx,
        "Client",
        _recording_client_factory(
            _RecordingClient(
                [
                    _name_response("결제 금액 확인"),
                    {
                        "description": "고객의 결제 금액 문의를 확인하고 처리 기준을 안내합니다.",
                        "usedEvidenceIds": ["c1"],
                        "abstain": "false",
                    },
                ]
            )
        ),
    )
    candidate = _candidate()

    summary = enrich_candidate_descriptions(candidate, _runtime_config(tmp_path), logger=logging.getLogger(__name__))

    assert summary is not None
    assert summary["schemaValidCount"] == 1
    assert summary["schemaFailureCount"] == 1
    assert summary["fallbackCount"] == 1


def test_description_enrichment_parses_fenced_json_content() -> None:
    parsed = description_enrichment._parse_response(
        {
            "choices": [
                {
                    "message": {
                        "content": '```json\n{"name":"카드 한도 상향","usedEvidenceIds":["c1"],"abstain":false}\n```',
                    }
                }
            ]
        }
    )

    assert parsed == {"name": "카드 한도 상향", "usedEvidenceIds": ["c1"], "abstain": False}


def test_description_enrichment_rejects_empty_and_too_long_content(monkeypatch, tmp_path: Path) -> None:
    fake_client = _RecordingClient(
        [
            _name_response("결제 금액 확인"),
            {"name": "결제 금액 처리", "usedEvidenceIds": ["workflow-graph"], "abstain": False},
            {"description": "", "usedEvidenceIds": ["c1"], "abstain": False},
            {"description": "가" * 221, "usedEvidenceIds": ["workflow-graph"], "abstain": False},
        ]
    )
    monkeypatch.setattr(description_enrichment.httpx, "Client", _recording_client_factory(fake_client))
    candidate = _candidate_with_workflow()

    summary = enrich_candidate_descriptions(candidate, _runtime_config(tmp_path))

    assert summary is not None
    assert summary["schemaValidCount"] == 4
    assert summary["contentValidationFailureCount"] == 2
    assert summary["fallbackCount"] == 2


def test_description_enrichment_uses_workflow_evidence_from_graph(monkeypatch, tmp_path: Path) -> None:
    fake_client = _RecordingClient(
        [
            _name_response("결제 금액 확인"),
            {"name": "결제 금액 처리", "usedEvidenceIds": ["workflow-graph"], "abstain": False},
            _response(abstain=False),
            {
                "description": "본인 확인 후 결제 금액 문의를 처리합니다.",
                "usedEvidenceIds": ["workflow-graph"],
                "abstain": False,
            },
        ]
    )
    monkeypatch.setattr(description_enrichment.httpx, "Client", _recording_client_factory(fake_client))
    candidate = _candidate_with_workflow()

    summary = enrich_candidate_descriptions(candidate, _runtime_config(tmp_path))

    assert summary is not None
    assert summary["appliedCount"] == 4
    workflow = candidate["workflowDraft"]["workflows"][0]
    assert workflow["description"] == "본인 확인 후 결제 금액 문의를 처리합니다."
    assert "id=workflow-graph" in fake_client.requests[3]["json"]["messages"][1]["content"]


def test_description_enrichment_helpers_handle_malformed_inputs(monkeypatch) -> None:
    monkeypatch.setenv("ML_DESCRIPTION_ENRICHMENT_TIMEOUT_SECONDS", "-1")
    monkeypatch.setenv("ML_DESCRIPTION_ENRICHMENT_LIMIT", "abc")

    assert description_enrichment._timeout_seconds() == 30.0
    assert description_enrichment._entity_limit() is None
    assert description_enrichment._parse_json_value("{") is None
    assert description_enrichment._description_entities({"intentDraft": {"intents": []}}) == []


class _FakeResponse:
    def __init__(self, payload: dict[str, Any]) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, Any]:
        return {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(self._payload, ensure_ascii=False),
                    }
                }
            ]
        }


class _FakeClient:
    def __init__(self, payload: dict[str, Any] | Exception) -> None:
        self._payload = payload

    def __enter__(self) -> "_FakeClient":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def post(self, *_args: object, **_kwargs: object) -> _FakeResponse:
        if isinstance(self._payload, Exception):
            raise self._payload
        return _FakeResponse(self._payload)


class _RecordingClient:
    def __init__(self, payloads: list[dict[str, Any]]) -> None:
        self._payloads = payloads
        self.requests: list[dict[str, Any]] = []

    def __enter__(self) -> "_RecordingClient":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def post(self, *_args: object, **kwargs: object) -> _FakeResponse:
        self.requests.append(dict(kwargs))
        return _FakeResponse(self._payloads.pop(0))


def _fake_client_factory(payload: dict[str, Any] | Exception) -> type[_FakeClient]:
    class BoundFakeClient(_FakeClient):
        def __init__(self, *_args: object, **_kwargs: object) -> None:
            super().__init__(payload)

    return BoundFakeClient


def _recording_client_factory(client: _RecordingClient) -> type[_RecordingClient]:
    class BoundRecordingClient(_RecordingClient):
        def __init__(self, *_args: object, **_kwargs: object) -> None:
            return None

        def __enter__(self) -> _RecordingClient:
            return client

    return BoundRecordingClient


def _response(abstain: bool) -> dict[str, Any]:
    return {
        "description": "고객의 결제 금액 문의를 확인하고 처리 기준을 안내합니다.",
        "usedEvidenceIds": ["c1"],
        "abstain": abstain,
    }


def _name_response(name: str, abstain: bool = False) -> dict[str, Any]:
    return {
        "name": name,
        "usedEvidenceIds": ["c1"],
        "abstain": abstain,
    }


def _candidate() -> dict[str, Any]:
    return {
        "intentDraft": {
            "intents": [
                {
                    "intentCode": "INTENT_1",
                    "name": "결제 금액 문의",
                    "description": "결제 문의 클러스터",
                    "evidenceJson": json.dumps({"exemplarConversationIds": ["c1"]}, ensure_ascii=False),
                    "representativeCases": [
                        {
                            "conversationId": "c1",
                            "customerProblemText": "결제 금액을 확인하고 싶어요",
                            "canonicalText": "결제 금액 문의",
                        }
                    ],
                }
            ]
        },
        "workflowDraft": {"workflows": [], "slots": [], "policies": [], "risks": []},
    }


def _candidate_with_duplicate_intents() -> dict[str, Any]:
    candidate = _candidate()
    base_intent = candidate["intentDraft"]["intents"][0]
    candidate["intentDraft"]["intents"] = [
        base_intent,
        {
            **base_intent,
            "intentCode": "INTENT_2",
            "name": "결제 확인 문의",
        },
        {
            **base_intent,
            "intentCode": "INTENT_3",
            "name": "결제 한도 문의",
        },
    ]
    return candidate


def _candidate_with_workflow() -> dict[str, Any]:
    candidate = _candidate()
    candidate["workflowDraft"]["workflows"] = [
        {
            "workflowCode": "WORKFLOW_1",
            "name": "결제 금액 확인",
            "description": "결제 금액 확인 흐름",
            "evidenceJson": json.dumps(
                [
                    {"type": "evidence_span", "conversationId": "c2", "value": "결제 금액 확인 요청"},
                    {"type": "keyword", "value": "결제"},
                    "malformed",
                ],
                ensure_ascii=False,
            ),
            "graphJson": json.dumps(
                {"nodes": [{"label": "본인 확인"}, {"label": "결제 금액 안내"}]},
                ensure_ascii=False,
            ),
        }
    ]
    return candidate


def _candidate_with_rough_workflow_name() -> dict[str, Any]:
    candidate = _candidate_with_workflow()
    candidate["workflowDraft"]["workflows"][0]["name"] = "결제 금액 / 이용 문의 - 본인확인 필요 · 결제확인 필요"
    return candidate


def _runtime_config(tmp_path: Path, api_key: str | None = None) -> PipelineRuntimeConfig:
    return PipelineRuntimeConfig(
        artifact_root=tmp_path,
        backend_base_url="http://backend:8080",
        llm_runtime_base_url="http://127.0.0.1:18080/v1",
        llm_model_name="gemma-local",
        llm_runtime_api_key=api_key,
    )
