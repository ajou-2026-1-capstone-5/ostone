from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

import httpx
import pytest

from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.exceptions import PipelineStageError
from pipeline.stages.feedback_candidate_generation import review_question_enrichment
from pipeline.stages.feedback_candidate_generation.main import run


def test_feedback_questions_include_caselet_review_context(monkeypatch, tmp_path: Path) -> None:
    artifact_root = tmp_path / "artifacts"
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    upstream_manifest = _write_feedback_stage_inputs(artifact_root)

    result = run(str(upstream_manifest))

    output_dir = Path(cast(str, result["artifact_manifest_path"])).parent
    questions = json.loads((output_dir / "feedback_review_questions.json").read_text(encoding="utf-8"))
    manifest = json.loads((output_dir / "manifest.json").read_text(encoding="utf-8"))

    question = questions["questions"][0]
    assert question["questionType"] == "WORKFLOW_BOUNDARY"
    assert question["decisionScope"] == "workflow"
    assert question["questionText"] == "같은 intent 안에서 두 상담을 같은 workflow로 합쳐도 되나요?"
    assert [option["value"] for option in question["answerOptions"]] == [
        "same_workflow",
        "same_intent_separate_workflow",
        "different_intent",
        "unsure",
    ]
    assert question["sourceSnippet"] == "공항 픽업 예약을 변경하고 싶어요."
    assert question["targetSnippet"] == "호텔 조식 포함 여부를 확인하고 싶습니다."
    assert question["sourceReviewContext"]["summary"] == "공항 픽업 예약 변경"
    assert question["targetReviewContext"]["summary"] == "호텔 조식 확인"
    assert question["sourceReviewContext"]["logExcerpt"].startswith("공항 픽업 예약을 변경")
    assert questions["enrichmentSummary"]["enabled"] is True
    assert questions["enrichmentSummary"]["fallbackReason"] == "missing_llm_runtime_base_url"
    assert questions["enrichmentSummary"]["fallbackCount"] == 1
    assert question["sourceClusterId"] == "0"
    assert questions["qualityKpis"]["questionTypeDistribution"] == {"WORKFLOW_BOUNDARY": 1}
    assert questions["qualityKpis"]["caseletRepeatRate"] == 0.0
    assert questions["qualityKpis"]["sourceClusterDominance"] == 1.0
    assert manifest["payload"]["metrics"]["qualityKpis"] == questions["qualityKpis"]
    assert manifest["payload"]["metrics"]["reviewQuestionEnrichmentEnabled"] is True
    assert manifest["payload"]["metrics"]["reviewQuestionEnrichmentFallbackCount"] == 1


def test_low_confidence_cluster_questions_remain_intent_boundary(monkeypatch, tmp_path: Path) -> None:
    artifact_root = tmp_path / "artifacts"
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    upstream_manifest = _write_low_confidence_stage_inputs(artifact_root)

    result = run(str(upstream_manifest))

    output_dir = Path(cast(str, result["artifact_manifest_path"])).parent
    questions = json.loads((output_dir / "feedback_review_questions.json").read_text(encoding="utf-8"))
    question = questions["questions"][0]

    assert question["questionType"] == "INTENT_BOUNDARY"
    assert question["decisionScope"] == "intent"
    assert question["questionText"] == "두 상담을 같은 intent로 묶어도 되나요?"
    assert [option["value"] for option in question["answerOptions"]] == [
        "must_link",
        "cannot_link",
        "unsure",
    ]


def test_feedback_questions_apply_valid_llm_enrichment_and_manifest_metrics(
    monkeypatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("LLM_RUNTIME_BASE_URL", "http://127.0.0.1:18080/v1")
    monkeypatch.setenv("LLM_MODEL_NAME", "gemma-local")
    monkeypatch.setattr(
        review_question_enrichment.httpx,
        "Client",
        _fake_client_factory(_valid_enrichment_response()),
    )
    artifact_root = tmp_path / "artifacts"
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    upstream_manifest = _write_feedback_stage_inputs(artifact_root)

    result = run(str(upstream_manifest))

    output_dir = Path(cast(str, result["artifact_manifest_path"])).parent
    artifact = json.loads((output_dir / "feedback_review_questions.json").read_text(encoding="utf-8"))
    manifest = json.loads(Path(cast(str, result["artifact_manifest_path"])).read_text(encoding="utf-8"))
    question = artifact["questions"][0]
    assert question["questionText"] == "공항 픽업 예약 변경과 호텔 조식 확인을 같은 intent로 묶어도 되나요?"
    assert question["sourceReviewContext"]["summary"] == "공항 픽업 예약 변경"
    assert question["sourceReviewContext"]["enrichedSummary"] == "고객은 공항 픽업 예약 날짜 변경을 요청합니다."
    assert question["targetReviewContext"]["summary"] == "호텔 조식 포함 확인"
    assert question["commonGround"] == "두 상담 모두 예약 관련 문의입니다."
    assert question["choiceExplanations"]["cannot_link"] == "요청 대상과 처리 기준이 다르면 분리합니다."
    assert artifact["enrichmentSummary"]["appliedCount"] == 1
    assert manifest["payload"]["metrics"]["reviewQuestionEnrichmentAppliedCount"] == 1
    assert manifest["payload"]["metrics"]["reviewQuestionEnrichmentFallbackCount"] == 0


def test_review_question_enrichment_rejects_schema_failures(monkeypatch, tmp_path: Path) -> None:
    question = _question_payload()
    monkeypatch.setattr(
        review_question_enrichment.httpx,
        "Client",
        _fake_client_factory({"operatorQuestion": "같은 업무인가요?"}),
    )

    summary = review_question_enrichment.enrich_review_questions([question], _runtime_config(tmp_path))

    assert summary["schemaFailureCount"] == 1
    assert summary["fallbackCount"] == 1


def test_review_question_enrichment_rejects_unknown_evidence(monkeypatch, tmp_path: Path) -> None:
    question = _question_payload()
    monkeypatch.setattr(
        review_question_enrichment.httpx,
        "Client",
        _fake_client_factory({**_valid_enrichment_response(), "usedEvidenceIds": ["unknown"]}),
    )

    summary = review_question_enrichment.enrich_review_questions([question], _runtime_config(tmp_path))

    assert summary["groundingFailureCount"] == 1
    assert summary["fallbackCount"] == 1
    assert question["questionText"] == "두 상담을 같은 intent로 묶어도 되나요?"


def test_review_question_enrichment_handles_request_failure(monkeypatch, tmp_path: Path) -> None:
    question = _question_payload()
    monkeypatch.setattr(
        review_question_enrichment.httpx,
        "Client",
        _fake_client_factory(httpx.ConnectError("connection failed")),
    )

    with pytest.raises(PipelineStageError, match="Review question LLM enrichment failed"):
        review_question_enrichment.enrich_review_questions([question], _runtime_config(tmp_path))


def test_review_question_enrichment_keeps_abstain_as_low_priority(monkeypatch, tmp_path: Path) -> None:
    question = _question_payload()
    monkeypatch.setattr(
        review_question_enrichment.httpx,
        "Client",
        _fake_client_factory(
            {
                **_valid_enrichment_response(),
                "abstain": True,
                "abstainReason": "두 후보를 비교할 충분한 근거가 없습니다.",
            }
        ),
    )

    summary = review_question_enrichment.enrich_review_questions([question], _runtime_config(tmp_path))

    assert summary["abstainCount"] == 1
    assert summary["lowPriorityCount"] == 1
    assert question["priority"] == "LOW"
    assert question["abstainReason"] == "두 후보를 비교할 충분한 근거가 없습니다."


def test_review_question_enrichment_rejects_broken_label_patterns(monkeypatch, tmp_path: Path) -> None:
    question = _question_payload()
    monkeypatch.setattr(
        review_question_enrichment.httpx,
        "Client",
        _fake_client_factory(
            {
                **_valid_enrichment_response(),
                "sourceTitle": "지역 이동할 원화로 견적",
            }
        ),
    )

    summary = review_question_enrichment.enrich_review_questions([question], _runtime_config(tmp_path))

    assert summary["contentValidationFailureCount"] == 1
    assert summary["fallbackCount"] == 1
    source_context = cast(dict[str, object], question["sourceReviewContext"])
    assert source_context["summary"] == "공항 픽업 예약 변경"


def test_review_question_enrichment_falls_back_without_llm_base_url(monkeypatch, tmp_path: Path) -> None:
    question = _question_payload()

    summary = review_question_enrichment.enrich_review_questions(
        [question],
        PipelineRuntimeConfig(
            artifact_root=tmp_path,
            backend_base_url="http://backend:8080",
            llm_runtime_base_url=None,
            llm_model_name="gemma-local",
        ),
    )

    assert summary["requestFailureCount"] == 1
    assert summary["fallbackCount"] == 1
    assert summary["fallbackReason"] == "missing_llm_runtime_base_url"
    assert question["enrichmentStatus"] == "fallback"
    assert question["enrichmentFallbackReason"] == "missing_llm_runtime_base_url"


def test_review_question_enrichment_sends_runtime_options_and_respects_limit(
    monkeypatch,
    tmp_path: Path,
) -> None:
    question = _question_payload()
    second_question = {**_question_payload(), "questionId": "cannot-link-1-2"}
    client_class = _fake_client_factory(_fenced_json_response(_valid_enrichment_response()))
    monkeypatch.setenv("ML_REVIEW_QUESTION_ENRICHMENT_LIMIT", "1")
    monkeypatch.setenv("ML_REVIEW_QUESTION_ENRICHMENT_TIMEOUT_SECONDS", "not-a-number")
    monkeypatch.setattr(review_question_enrichment.httpx, "Client", client_class)

    summary = review_question_enrichment.enrich_review_questions(
        [question, second_question],
        PipelineRuntimeConfig(
            artifact_root=tmp_path,
            backend_base_url="http://backend:8080",
            llm_runtime_base_url="http://127.0.0.1:18080/v1",
            llm_runtime_api_key="local-token",
            llm_model_name="gemma-local",
        ),
    )

    assert summary["appliedCount"] == 1
    assert summary["skippedByLimitCount"] == 1
    assert second_question.get("enrichmentStatus") is None
    assert _FakeClient.calls[0]["headers"]["Authorization"] == "Bearer local-token"
    assert _FakeClient.calls[0]["json"]["chat_template_kwargs"] == {"enable_thinking": False}
    assert _FakeClient.calls[0]["json"]["options"] == {"think": False}
    assert question["enrichmentStatus"] == "applied"


def test_review_question_enrichment_rejects_missing_grounding_and_invalid_limit(
    monkeypatch,
    tmp_path: Path,
) -> None:
    question = _question_payload()
    monkeypatch.setenv("ML_REVIEW_QUESTION_ENRICHMENT_LIMIT", "bad-limit")
    monkeypatch.setattr(
        review_question_enrichment.httpx,
        "Client",
        _fake_client_factory({**_valid_enrichment_response(), "usedEvidenceIds": []}),
    )

    summary = review_question_enrichment.enrich_review_questions([question], _runtime_config(tmp_path))

    assert summary["groundingFailureCount"] == 1
    assert question["enrichmentFallbackReason"] == "missing_grounding_evidence"


def test_feedback_question_quality_kpis_measure_repeats_and_question_mix() -> None:
    questions: list[dict[str, object]] = [
        {
            "questionId": "cannot-link-7-1",
            "sourceClusterId": "7",
            "sourceId": "case-1",
            "targetId": "case-2",
            "recommendedConstraintType": "cannot_link",
            "reason": "same_source_cluster_split",
            "answer": "unsure",
        },
        {
            "questionId": "must-link-7-1",
            "sourceClusterId": "7",
            "sourceId": "case-1",
            "targetId": "case-3",
            "recommendedConstraintType": "must_link",
            "reason": "low_confidence_cluster_boundary",
        },
        {
            "questionId": "cannot-link-9-1",
            "sourceClusterId": "9",
            "sourceId": "case-4",
            "targetId": "case-5",
            "recommendedConstraintType": "cannot_link",
            "reason": "mixed_residual_boundary",
        },
    ]

    from pipeline.stages.feedback_candidate_generation.main import _quality_kpis

    kpis = _quality_kpis(questions)

    assert kpis["unsureRate"] == 1.0
    assert kpis["caseletRepeatRate"] == 0.333333
    assert kpis["sourceClusterDominance"] == 0.666667
    balance = cast(dict[str, object], kpis["mustCannotBalance"])
    assert balance["mustLinkCount"] == 1
    assert balance["cannotLinkCount"] == 2
    assert kpis["weakLabelQuestionRate"] == 0.333333
    assert kpis["mixedResidualQuestionRate"] == 0.333333
    assert kpis["questionTypeDistribution"] == {"cannot_link": 2, "must_link": 1}


class _FakeResponse:
    def __init__(self, payload: dict[str, Any] | str) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, Any]:
        content = self._payload if isinstance(self._payload, str) else json.dumps(self._payload, ensure_ascii=False)
        return {
            "choices": [
                {
                    "message": {
                        "content": content,
                    }
                }
            ]
        }


class _FakeClient:
    calls: list[dict[str, Any]] = []

    def __init__(self, payload: dict[str, Any] | str | Exception) -> None:
        self._payload = payload

    def __enter__(self) -> "_FakeClient":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def post(self, *_args: object, **kwargs: object) -> _FakeResponse:
        _FakeClient.calls.append(cast(dict[str, Any], kwargs))
        if isinstance(self._payload, Exception):
            raise self._payload
        return _FakeResponse(self._payload)


def _fake_client_factory(payload: dict[str, Any] | str | Exception) -> type[_FakeClient]:
    _FakeClient.calls = []

    class BoundFakeClient(_FakeClient):
        def __init__(self, *_args: object, **_kwargs: object) -> None:
            super().__init__(payload)

    return BoundFakeClient


def _fenced_json_response(payload: dict[str, Any]) -> str:
    return f"```json\n{json.dumps(payload, ensure_ascii=False)}\n```"


def _write_feedback_stage_inputs(artifact_root: Path) -> Path:
    base_dir = artifact_root / "domain_pack_generation" / "manual__run"
    flow_dir = base_dir / "flow_splitting"
    preprocessing_dir = base_dir / "preprocessing"
    flow_dir.mkdir(parents=True)
    preprocessing_dir.mkdir(parents=True)
    (flow_dir / "clusters.json").write_text(json.dumps({"clusters": []}), encoding="utf-8")
    (flow_dir / "workflow_entrypoints.json").write_text(
        json.dumps(
            {
                "workflowEntryPoints": [
                    {
                        "sourceClusterId": 0,
                        "confidence": 0.42,
                        "exemplarConversationIds": ["conv-1#issue-01"],
                    },
                    {
                        "sourceClusterId": 0,
                        "confidence": 0.55,
                        "exemplarConversationIds": ["conv-1#issue-02"],
                    },
                ]
            }
        ),
        encoding="utf-8",
    )
    (preprocessing_dir / "preprocessed_data.json").write_text(
        json.dumps({"issueCaselets": [_source_caselet(), _target_caselet()]}),
        encoding="utf-8",
    )
    upstream_manifest = flow_dir / "manifest.json"
    upstream_manifest.write_text(
        json.dumps(
            {
                "dag_id": "domain_pack_generation",
                "run_id": "manual__run",
                "workspace_id": "3",
                "dataset_id": "5",
                "pipeline_job_id": "11",
            }
        ),
        encoding="utf-8",
    )
    return upstream_manifest


def _write_low_confidence_stage_inputs(artifact_root: Path) -> Path:
    base_dir = artifact_root / "domain_pack_generation" / "manual__run"
    flow_dir = base_dir / "flow_splitting"
    preprocessing_dir = base_dir / "preprocessing"
    flow_dir.mkdir(parents=True)
    preprocessing_dir.mkdir(parents=True)
    (flow_dir / "clusters.json").write_text(
        json.dumps(
            {
                "clusters": [
                    {
                        "cluster_id": 3,
                        "workflow_confidence": 0.37,
                        "exemplar_conv_ids": ["conv-2#issue-01", "conv-3#issue-01"],
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    (flow_dir / "workflow_entrypoints.json").write_text(
        json.dumps({"workflowEntryPoints": []}),
        encoding="utf-8",
    )
    (preprocessing_dir / "preprocessed_data.json").write_text(
        json.dumps(
            {
                "issueCaselets": [
                    {"caseletId": "conv-2#issue-01", "customerIssueText": "결제 취소가 필요합니다."},
                    {"caseletId": "conv-3#issue-01", "customerIssueText": "환불 조건을 알고 싶습니다."},
                ]
            }
        ),
        encoding="utf-8",
    )
    upstream_manifest = flow_dir / "manifest.json"
    upstream_manifest.write_text(
        json.dumps(
            {
                "dag_id": "domain_pack_generation",
                "run_id": "manual__run",
                "workspace_id": "3",
                "dataset_id": "5",
                "pipeline_job_id": "11",
            }
        ),
        encoding="utf-8",
    )
    return upstream_manifest


def _source_caselet() -> dict[str, Any]:
    return {
        "caseletId": "conv-1#issue-01",
        "conversationId": "conv-1",
        "customerIssueText": "공항 픽업 예약을 변경하고 싶어요.",
        "canonicalText": "공항 픽업 예약을 변경하고 싶어요. 날짜를 바꿔주세요.",
        "actionObjectFrame": {
            "action": "변경",
            "object": "공항 픽업 예약",
            "intentType": "change_request",
        },
        "qualityTier": "high",
        "evidenceTurnIds": ["turn-1"],
    }


def _target_caselet() -> dict[str, Any]:
    return {
        "caseletId": "conv-1#issue-02",
        "conversationId": "conv-1",
        "customerIssueText": "호텔 조식 포함 여부를 확인하고 싶습니다.",
        "canonicalText": "호텔 조식 포함 여부를 확인하고 싶습니다.",
        "actionObjectFrame": {
            "action": "확인",
            "object": "호텔 조식",
            "intentType": "information_request",
        },
        "qualityTier": "medium",
        "evidenceTurnIds": ["turn-7"],
    }


def _question_payload() -> dict[str, object]:
    return {
        "questionId": "cannot-link-1-1",
        "questionText": "두 상담을 같은 intent로 묶어도 되나요?",
        "sourceId": "conv-1#issue-01",
        "targetId": "conv-1#issue-02",
        "sourceReviewContext": {
            "id": "conv-1#issue-01",
            "summary": "공항 픽업 예약 변경",
            "action": "변경",
            "object": "공항 픽업 예약",
            "intentType": "change_request",
            "signals": ["공항 픽업 예약", "변경", "high"],
            "logExcerpt": "공항 픽업 예약을 변경하고 싶어요. 날짜를 바꿔주세요.",
        },
        "targetReviewContext": {
            "id": "conv-1#issue-02",
            "summary": "호텔 조식 확인",
            "action": "확인",
            "object": "호텔 조식",
            "intentType": "information_request",
            "signals": ["호텔 조식", "확인", "medium"],
            "logExcerpt": "호텔 조식 포함 여부를 확인하고 싶습니다.",
        },
        "sourceSnippet": "공항 픽업 예약을 변경하고 싶어요.",
        "targetSnippet": "호텔 조식 포함 여부를 확인하고 싶습니다.",
        "recommendedConstraintType": "cannot_link",
        "reason": "same_source_cluster_split",
        "reasonLabel": "같은 클러스터에서 서로 다른 workflow 후보로 갈라졌습니다.",
        "priority": "HIGH",
    }


def _valid_enrichment_response() -> dict[str, Any]:
    return {
        "questionType": "cannot_link",
        "sourceTitle": "공항 픽업 예약 변경",
        "targetTitle": "호텔 조식 포함 확인",
        "sourceSummary": "고객은 공항 픽업 예약 날짜 변경을 요청합니다.",
        "targetSummary": "고객은 호텔 예약에 조식이 포함되는지 확인하려 합니다.",
        "commonGround": "두 상담 모두 예약 관련 문의입니다.",
        "keyDifferences": ["한쪽은 이동 서비스 예약 변경이고 다른 쪽은 호텔 식사 포함 여부 확인입니다."],
        "operatorQuestion": "공항 픽업 예약 변경과 호텔 조식 확인을 같은 intent로 묶어도 되나요?",
        "choiceExplanations": {
            "must_link": "예약 변경과 예약 정보 확인을 같은 업무로 운영한다면 묶습니다.",
            "cannot_link": "요청 대상과 처리 기준이 다르면 분리합니다.",
            "unsure": "운영 정책상 예약 부가서비스를 같은 큐로 처리하는지 확인이 필요하면 보류합니다.",
        },
        "usedEvidenceIds": ["source.snippet", "target.snippet", "source.metadata", "target.metadata"],
        "abstain": False,
        "abstainReason": "",
    }


def _runtime_config(tmp_path: Path) -> PipelineRuntimeConfig:
    return PipelineRuntimeConfig(
        artifact_root=tmp_path,
        backend_base_url="http://backend:8080",
        llm_runtime_base_url="http://127.0.0.1:18080/v1",
        llm_model_name="gemma-local",
    )
