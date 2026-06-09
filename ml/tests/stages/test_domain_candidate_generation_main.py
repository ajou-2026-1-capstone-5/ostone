from __future__ import annotations

import json
from typing import Any

import pytest

from pipeline.common.exceptions import PipelineStageError
from pipeline.stages.domain_candidate_generation import main
from pipeline.stages.preprocessing.types import FLOW_SIGNATURE_DIM, ProcessedConversation


def _conversation(conversation_id: str, text: str) -> ProcessedConversation:
    return ProcessedConversation(
        id=conversation_id,
        dataset_id="dataset-1",
        canonical_text=text,
        customer_problem_text=text,
        flow_signature=(0.0,) * FLOW_SIGNATURE_DIM,
        flow_signature_dim=FLOW_SIGNATURE_DIM,
        turn_count=2,
        customer_turn_count=1,
        pii_mask_count=0,
        filtered=False,
    )


def test_normalize_candidates_keeps_valid_llm_domains_with_evidence_and_rationale() -> None:
    sampled = [
        _conversation("c1", "카드 분실 정지"),
        _conversation("c2", "카드 결제 한도"),
        _conversation("c3", "앱 로그인 오류"),
    ]
    snippet_index = main._snippet_index(sampled)

    candidates = main._normalize_candidates(
        [
            {
                "displayName": "카드 상담",
                "confidence": 1.7,
                "description": "카드 업무",
                "rationale": "카드 분실·정지 문의가 반복됩니다.",
                "evidenceTerms": ["카드", "", "한도", "문의"],
                "evidenceConversationIds": ["c1", "missing"],
                "suggestedDomainLexicon": ["분실", "결제"],
            },
            {"displayName": "카드 상담", "confidence": 0.3},
            {
                "name": "앱 지원",
                "confidence": False,
                "evidenceConversationIds": ["c3"],
            },
        ],
        ["카드", "분실", "한도"],
        sampled,
        snippet_index,
    )

    # `혼합 또는 미확정` 후보는 normalize가 붙이지 않는다(실질 domain만 반환).
    assert [candidate["candidateId"] for candidate in candidates] == ["카드_상담", "앱_지원"]
    assert all(candidate["kind"] == main.CANDIDATE_KIND_DOMAIN for candidate in candidates)
    assert candidates[0]["confidence"] == 1.0
    assert candidates[0]["evidenceConversationIds"] == ["c1"]
    assert candidates[0]["rationale"] == "카드 분실·정지 문의가 반복됩니다."
    # stopword("문의")와 빈 토큰은 evidenceTerms에서 제거된다.
    assert candidates[0]["evidenceTerms"] == ["카드", "한도"]
    # evidenceConversationIds의 표시 가능한 snippet이 후보에 포함된다.
    assert candidates[0]["evidenceSnippets"] == [{"conversationId": "c1", "snippet": "카드 분실 정지"}]
    # rationale가 없으면 evidenceTerms 기반으로 합성한다.
    second_rationale = candidates[1]["rationale"]
    assert isinstance(second_rationale, str)
    assert second_rationale.startswith("앱 지원 관련 표현")
    assert candidates[1]["description"] == "앱 지원 상담 도메인"


def test_normalize_candidates_returns_empty_when_llm_output_has_too_few_valid_domains() -> None:
    sampled = [_conversation("c1", "배송지 변경")]

    candidates = main._normalize_candidates(
        [{"displayName": ""}, {"description": "이름 없음"}],
        ["배송지"],
        sampled,
        main._snippet_index(sampled),
    )

    assert candidates == []


def test_normalize_candidates_drops_overly_generic_cross_candidate_terms() -> None:
    sampled = [_conversation("c1", "카드 환불"), _conversation("c2", "예약 환불")]

    candidates = main._normalize_candidates(
        [
            {"displayName": "카드 상담", "suggestedDomainLexicon": ["카드", "환불"]},
            {"displayName": "예약 상담", "suggestedDomainLexicon": ["예약", "환불"]},
        ],
        ["카드", "예약"],
        sampled,
        main._snippet_index(sampled),
    )

    # "환불"은 두 후보 모두에 등장하는 일반어이므로 각 lexicon에서 제거된다.
    assert candidates[0]["suggestedDomainLexicon"] == ["카드"]
    assert candidates[1]["suggestedDomainLexicon"] == ["예약"]


def test_resolve_fallback_reason_classifies_each_failure() -> None:
    assert main._resolve_fallback_reason(main.FALLBACK_LLM_REQUEST_FAILURE, 0, 24) == main.FALLBACK_LLM_REQUEST_FAILURE
    assert (
        main._resolve_fallback_reason(main.FALLBACK_SCHEMA_VALIDATION_FAILURE, 0, 24)
        == main.FALLBACK_SCHEMA_VALIDATION_FAILURE
    )
    assert main._resolve_fallback_reason(None, 0, 1) == main.FALLBACK_INSUFFICIENT_EVIDENCE
    assert main._resolve_fallback_reason(None, 0, 24) == main.FALLBACK_GENUINELY_MIXED
    # 실질 후보가 있으면 fallback이 아니다.
    assert main._resolve_fallback_reason(None, 2, 24) is None


def test_mixed_unknown_candidate_carries_fallback_metadata() -> None:
    sampled = [_conversation("c1", "예약 변경"), _conversation("c2", "결제 오류")]

    candidate = main._mixed_unknown_candidate(
        ["예약", "결제"],
        sampled,
        main._snippet_index(sampled),
        main.FALLBACK_GENUINELY_MIXED,
    )

    assert candidate["candidateId"] == main.MIXED_UNKNOWN_ID
    assert candidate["kind"] == main.CANDIDATE_KIND_FALLBACK
    assert candidate["isFallback"] is True
    assert candidate["fallbackReason"] == main.FALLBACK_GENUINELY_MIXED
    assert candidate["rationale"] == main._FALLBACK_RATIONALE[main.FALLBACK_GENUINELY_MIXED]
    snippets = candidate["evidenceSnippets"]
    assert isinstance(snippets, list)
    assert snippets[0] == {"conversationId": "c1", "snippet": "예약 변경"}


def test_mixed_unknown_candidate_uses_alternative_rationale_without_failure() -> None:
    sampled = [_conversation("c1", "예약 변경")]

    candidate = main._mixed_unknown_candidate(["예약"], sampled, main._snippet_index(sampled), None)

    assert candidate["fallbackReason"] is None
    assert candidate["rationale"] == main._MIXED_ALTERNATIVE_RATIONALE


def test_sampling_and_runtime_knobs_are_bounded(monkeypatch: pytest.MonkeyPatch) -> None:
    conversations = [_conversation(f"c{i}", f"상담 {i}") for i in range(10)]

    sampled = main._deterministic_sample(conversations, 4)

    assert [conversation.id for conversation in sampled] == ["c0", "c3", "c6", "c9"]
    assert [conversation.id for conversation in main._deterministic_sample(conversations, 1)] == ["c4"]

    monkeypatch.setenv("PIPELINE_DOMAIN_CANDIDATE_SAMPLE_SIZE", "999")
    monkeypatch.setenv("PIPELINE_DOMAIN_CANDIDATE_LLM_TIMEOUT_SECONDS", "-3")
    assert main._sample_size() == 80
    assert main._llm_timeout() == 1.0
    assert main._llm_max_tokens() is None

    monkeypatch.setenv("PIPELINE_DOMAIN_CANDIDATE_SAMPLE_SIZE", "not-a-number")
    monkeypatch.setenv("PIPELINE_DOMAIN_CANDIDATE_LLM_TIMEOUT_SECONDS", "not-a-number")
    monkeypatch.setenv("PIPELINE_DOMAIN_CANDIDATE_LLM_MAX_TOKENS", "not-a-number")
    assert main._sample_size() == main.MAX_SAMPLE_SIZE
    assert main._llm_timeout() == main.DEFAULT_LLM_TIMEOUT_SECONDS
    assert main._llm_max_tokens() is None

    monkeypatch.setenv("PIPELINE_DOMAIN_CANDIDATE_LLM_MAX_TOKENS", "8192")
    assert main._llm_max_tokens() == main.MAX_LLM_MAX_TOKENS

    monkeypatch.setenv("PIPELINE_DOMAIN_CANDIDATE_LLM_MAX_TOKENS", "0")
    assert main._llm_max_tokens() is None


def test_generation_fallback_is_allowed_when_llm_runtime_is_not_configured() -> None:
    runtime_config = type("RuntimeConfig", (), {"llm_runtime_base_url": None})()

    assert main._allow_generation_fallback(runtime_config)


def test_generation_fallback_is_rejected_when_llm_runtime_is_configured() -> None:
    runtime_config = type("RuntimeConfig", (), {"llm_runtime_base_url": "http://llm.local/v1"})()

    assert not main._allow_generation_fallback(runtime_config)


def test_generation_fallback_can_be_explicitly_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    runtime_config = type("RuntimeConfig", (), {"llm_runtime_base_url": "http://llm.local/v1"})()
    monkeypatch.setenv("PIPELINE_DOMAIN_CANDIDATE_ALLOW_LLM_FALLBACK", "true")

    assert main._allow_generation_fallback(runtime_config)


def test_generation_fallback_can_be_explicitly_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    runtime_config = type("RuntimeConfig", (), {"llm_runtime_base_url": None})()
    monkeypatch.setenv("PIPELINE_DOMAIN_CANDIDATE_ALLOW_LLM_FALLBACK", "false")

    assert not main._allow_generation_fallback(runtime_config)


def _fallback_runtime_config(tmp_path) -> Any:
    return type(
        "RuntimeConfig",
        (),
        {
            "artifact_root": tmp_path,
            "backend_base_url": "http://backend:8080",
            "callback_enabled": False,
            "artifact_store": "local",
            "artifact_bucket": None,
            "artifact_prefix": "",
            "llm_runtime_base_url": "http://llm.local/v1",
            "llm_runtime_api_key": None,
            "llm_model_name": "model-a",
        },
    )()


def _patch_run_io(
    monkeypatch: pytest.MonkeyPatch, tmp_path, runtime_config: Any, sampled: list[ProcessedConversation]
) -> None:
    monkeypatch.setattr(main.PipelineRuntimeConfig, "from_env", lambda: runtime_config)
    monkeypatch.setattr(
        main,
        "read_stage_context",
        lambda _path, stage_name: type(
            "StageContext",
            (),
            {
                "dag_id": "dag",
                "run_id": "run1",
                "stage_name": stage_name,
                "workspace_id": "workspace-1",
                "dataset_id": "dataset-1",
                "pipeline_job_id": "job-1",
            },
        )(),
    )
    monkeypatch.setattr(main, "read_preprocessed_artifact", lambda _config, _context: (sampled, []))

    def fake_stage_directory(_context: object, _config: object):
        stage_dir = tmp_path / "dag" / "run1" / "domain_candidate_generation"
        stage_dir.mkdir(parents=True, exist_ok=True)
        return stage_dir

    monkeypatch.setattr(main, "ensure_stage_directory", fake_stage_directory)
    monkeypatch.setattr(main, "write_stage_manifest", lambda _context, _config, _metrics: tmp_path / "manifest.json")


def test_run_raises_when_configured_llm_generation_fails(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    runtime_config = _fallback_runtime_config(tmp_path)
    _patch_run_io(monkeypatch, tmp_path, runtime_config, [_conversation("c1", "예약")])
    monkeypatch.setattr(
        main,
        "_generate_llm_candidates",
        lambda *_args: (_ for _ in ()).throw(ValueError("bad llm response")),
    )

    with pytest.raises(PipelineStageError, match="Domain candidate LLM generation failed"):
        main.run("/tmp/upstream/manifest.json")


def test_run_records_llm_request_failure_fallback_reason_in_artifact(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    runtime_config = _fallback_runtime_config(tmp_path)
    sampled = [_conversation(f"c{i}", f"상담 {i} 환불") for i in range(5)]
    _patch_run_io(monkeypatch, tmp_path, runtime_config, sampled)
    monkeypatch.setenv("PIPELINE_DOMAIN_CANDIDATE_ALLOW_LLM_FALLBACK", "true")
    monkeypatch.setattr(
        main,
        "_generate_llm_candidates",
        lambda *_args: (_ for _ in ()).throw(main.httpx.ConnectError("connection refused")),
    )

    main.run("/tmp/upstream/manifest.json")

    artifact = json.loads((tmp_path / "dag" / "run1" / "domain_candidate_generation" / main.ARTIFACT_NAME).read_text())
    assert artifact["schemaVersion"] == "domain-candidates.v1"
    assert artifact["fallbackReason"] == main.FALLBACK_LLM_REQUEST_FAILURE
    assert artifact["candidates"][0]["candidateId"] == main.MIXED_UNKNOWN_ID
    assert artifact["candidates"][0]["fallbackReason"] == main.FALLBACK_LLM_REQUEST_FAILURE
    assert artifact["generationError"]["type"] == "ConnectError"


def test_prompt_and_terms_are_stable() -> None:
    sampled = [
        _conversation("c1", "고객 카드 분실 카드 정지 부탁드립니다"),
        _conversation("c2", "고객 앱 로그인 오류 확인"),
    ]

    terms = main._top_terms(sampled)
    prompt = json.loads(main._prompt(sampled, terms, "hash-1"))

    assert terms[:3] == ["카드", "분실", "정지"]
    assert prompt["sampleHash"] == "hash-1"
    assert prompt["samples"][0]["conversationId"] == "c1"
    assert "고객 카드 분실" in prompt["samples"][0]["text"]
    assert "rationale" in prompt["outputSchema"]["candidates"][0]


def test_generate_llm_candidates_posts_prompt_and_parses_response(monkeypatch: pytest.MonkeyPatch) -> None:
    sampled = [_conversation("c1", "카드 결제 한도 문의")]
    posts: list[dict[str, Any]] = []

    class FakeResponse:
        def raise_for_status(self) -> None:
            posts.append({"raised": True})

        def json(self) -> dict[str, object]:
            return {
                "choices": [
                    {
                        "finish_reason": "stop",
                        "message": {
                            "content": json.dumps(
                                {
                                    "candidates": [
                                        {
                                            "displayName": "카드 결제",
                                            "confidence": 0.91,
                                        },
                                        "ignored",
                                    ]
                                },
                                ensure_ascii=False,
                            )
                        },
                    }
                ]
            }

    class FakeClient:
        def __init__(self, timeout: float) -> None:
            posts.append({"timeout": timeout})

        def __enter__(self) -> "FakeClient":
            return self

        def __exit__(self, *_args: object) -> None:
            posts.append({"closed": True})

        def post(self, endpoint: str, *, headers: dict[str, str], json: dict[str, object]) -> FakeResponse:
            posts.append({"endpoint": endpoint, "headers": headers, "json": json})
            return FakeResponse()

    runtime_config = type(
        "RuntimeConfig",
        (),
        {
            "llm_runtime_base_url": "http://llm.local/",
            "llm_runtime_api_key": "secret-token",
            "llm_model_name": "model-a",
        },
    )()
    monkeypatch.setattr(main.httpx, "Client", FakeClient)
    monkeypatch.setenv("PIPELINE_DOMAIN_CANDIDATE_LLM_TIMEOUT_SECONDS", "3.5")

    candidates = main._generate_llm_candidates(runtime_config, sampled, ["카드"], "hash-1")

    assert candidates == [{"displayName": "카드 결제", "confidence": 0.91}]
    request = posts[1]
    assert request["endpoint"] == "http://llm.local/chat/completions"
    assert request["headers"]["Authorization"] == "Bearer secret-token"
    assert request["json"]["model"] == "model-a"
    assert "max_tokens" not in request["json"]
    assert request["json"]["chat_template_kwargs"] == {"enable_thinking": False}
    assert request["json"]["options"] == {"think": False}


def test_generate_llm_candidates_accepts_optional_max_tokens_override(monkeypatch: pytest.MonkeyPatch) -> None:
    sampled = [_conversation("c1", "카드 결제 한도 문의")]
    posts: list[dict[str, Any]] = []

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {"choices": [{"finish_reason": "stop", "message": {"content": '{"candidates":[]}'}}]}

    class FakeClient:
        def __init__(self, timeout: float) -> None:
            pass

        def __enter__(self) -> "FakeClient":
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def post(self, endpoint: str, *, headers: dict[str, str], json: dict[str, object]) -> FakeResponse:
            posts.append({"endpoint": endpoint, "headers": headers, "json": json})
            return FakeResponse()

    runtime_config = type(
        "RuntimeConfig",
        (),
        {
            "llm_runtime_base_url": "http://llm.local/",
            "llm_runtime_api_key": None,
            "llm_model_name": "model-a",
        },
    )()
    monkeypatch.setattr(main.httpx, "Client", FakeClient)
    monkeypatch.setenv("PIPELINE_DOMAIN_CANDIDATE_LLM_MAX_TOKENS", "2048")

    assert main._generate_llm_candidates(runtime_config, sampled, ["카드"], "hash-1") == []
    assert posts[0]["json"]["max_tokens"] == 2048


def test_parse_llm_json_response_reports_truncated_json() -> None:
    with pytest.raises(ValueError, match="truncated before valid JSON completed"):
        main._parse_llm_json_response('{"candidates":[{"displayName":"예약', "length")


def test_parse_llm_json_response_requires_json_object() -> None:
    with pytest.raises(ValueError, match="JSON object"):
        main._parse_llm_json_response("[]", "stop")


def test_normalize_candidates_trims_to_max_without_appending_fallback() -> None:
    sampled = [_conversation("c1", "배송 문의"), _conversation("c2", "교환 문의"), _conversation("c3", "환불 문의")]

    parsed = main._normalize_candidates(
        [
            {"displayName": "배송 상담"},
            {"displayName": "교환 상담"},
            {"displayName": "환불 상담"},
            {"displayName": "앱 상담"},
            {"displayName": "결제 상담"},
            {"displayName": "초과 후보"},
        ],
        ["배송", "교환"],
        sampled,
        main._snippet_index(sampled),
    )

    assert len(parsed) == main.MAX_CANDIDATES
    assert parsed[-1]["candidateId"] == "결제_상담"
    assert all(candidate["candidateId"] != main.MIXED_UNKNOWN_ID for candidate in parsed)
