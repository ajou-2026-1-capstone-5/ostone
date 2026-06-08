from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline.common.config import PipelineRuntimeConfig
from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineStageError
from pipeline.stages.flow_splitting import main as flow_splitting


def test_duplicate_generated_labels_fallback_lower_confidence_duplicate_only() -> None:
    clusters = [
        {
            "workflow_entrypoint_id": "entrypoint-1",
            "name": "금액 결제 문의",
            "suggested_name": "금액 결제 문의",
            "label_score": 0.78,
            "label_evidence_coverage": 0.66,
            "member_conv_ids": ["c1", "c2", "c3"],
        },
        {
            "workflow_entrypoint_id": "entrypoint-2",
            "suggested_name": "금액 결제 문의",
            "label_score": 0.60,
            "label_evidence_coverage": 0.28,
            "label_action_object_validity": 0.74,
            "member_conv_ids": ["c4", "c5"],
            "flow_split_key": "mixed_residual",
            "label_candidates": [{"name": "금액 결제 문의", "source": "action_object_frame"}],
        },
    ]

    flow_splitting._resolve_duplicate_generated_labels(
        clusters,
        {
            "c4": {"flow_events": ["확인질문", "정책안내"]},
            "c5": {"flow_events": ["확인질문", "확인질문"]},
        },
    )

    assert clusters[0]["suggested_name"] == "금액 결제 문의"
    assert clusters[1]["suggested_name"] == "미분류 문의"
    assert isinstance(clusters[1]["label_score"], float)
    assert clusters[1]["label_score"] <= 0.45


def test_duplicate_generated_labels_keep_evidence_backed_review_candidates() -> None:
    clusters = [
        {
            "workflow_entrypoint_id": "entrypoint-1",
            "suggested_name": "요금 납부 문의",
            "label_score": 0.78,
            "label_member_evidence_coverage": 0.72,
            "label_object_action_joint_coverage": 0.70,
            "label_action_object_validity": 0.80,
            "member_conv_ids": ["c1", "c2", "c3"],
        },
        {
            "workflow_entrypoint_id": "entrypoint-2",
            "suggested_name": "요금 납부 문의",
            "label_score": 0.58,
            "label_member_evidence_coverage": 0.42,
            "label_object_action_joint_coverage": 0.66,
            "label_action_object_validity": 0.74,
            "member_conv_ids": ["c4", "c5"],
            "label_candidates": [{"name": "요금 납부 문의", "source": "action_object_frame"}],
        },
    ]

    flow_splitting._resolve_duplicate_generated_labels(clusters, {})

    assert clusters[0]["suggested_name"] == "요금 납부 문의"
    assert clusters[1]["suggested_name"] == "요금 납부 문의"
    assert clusters[1]["label_validation_status"] == "needs_review"
    assert clusters[1].get("label_source") != "duplicate_weak_label_flow_fallback"


def test_duplicate_generated_labels_keep_high_joint_term_frequency_label() -> None:
    clusters = [
        {
            "workflow_entrypoint_id": "entrypoint-1",
            "suggested_name": "금액 결제 문의",
            "label_score": 0.78,
            "label_member_evidence_coverage": 0.80,
            "label_object_action_joint_coverage": 0.75,
            "label_action_object_validity": 0.80,
            "member_conv_ids": ["c1", "c2", "c3"],
        },
        {
            "workflow_entrypoint_id": "entrypoint-2",
            "suggested_name": "금액 결제 문의",
            "label_score": 0.735,
            "label_member_evidence_coverage": 0.875,
            "label_object_action_joint_coverage": 0.75,
            "label_action_object_validity": 0.35,
            "member_conv_ids": ["c4", "c5", "c6", "c7"],
            "flow_split_key": "requires_payment_check|action:결제",
            "label_candidates": [{"name": "금액 결제 문의", "source": "term_frequency"}],
        },
    ]

    flow_splitting._resolve_duplicate_generated_labels(clusters, {})

    assert clusters[1]["suggested_name"] == "금액 결제 문의"
    assert clusters[1]["label_validation_status"] == "needs_review"
    assert clusters[1].get("label_source") != "duplicate_weak_label_flow_fallback"


def test_novel_outlier_candidates_are_never_auto_labels() -> None:
    clusters: list[dict[str, object]] = [
        {
            "suggested_name": "카드 결제 문의",
            "label_validation_status": "auto_acceptable",
            "is_novel_outlier_candidate": True,
        },
        {
            "suggested_name": "카드 결제 문의",
            "label_validation_status": "auto_acceptable",
        },
    ]

    flow_splitting._enforce_review_only_labels(clusters)

    assert clusters[0]["label_validation_status"] == "needs_review"
    assert clusters[1]["label_validation_status"] == "auto_acceptable"


def test_split_label_terms_normalize_generic_amount_withdrawal_and_overage_forms() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2", "c3"],
        {
            "c1": {"customer_problem_text": "최소 결제 금액이 얼마죠"},
            "c2": {"customer_problem_text": "통장에서 인출해가시면 결제되나요"},
            "c3": {"customer_problem_text": "결제 금액이 초과돼 확인 부탁드립니다"},
        },
    )

    assert "얼마죠" not in label["name"]
    assert "인출해가시면" not in label["name"]
    assert "초과돼" not in label["name"]
    assert any(term in label["name"] for term in ("금액", "출금", "초과", "결제"))


def test_split_label_terms_filter_slot_identifiers_and_colloquial_endings() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2", "c3"],
        {
            "c1": {"customer_problem_text": "카드번호로 납부하려구요 결제 문의"},
            "c2": {"customer_problem_text": "납부 하려구 결제 금액이 얼만지 문의"},
            "c3": {"customer_problem_text": "것만 확인하고 납부 결제 문의"},
        },
    )

    assert "카드번호" not in label["name"]
    assert "하려구" not in label["name"]
    assert "것만" not in label["name"]
    assert "얼만" not in label["name"]
    assert any(term in label["name"] for term in ("납부", "결제", "금액"))


def test_regenerated_label_infers_action_from_text_when_term_label_is_object_only() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2", "c3"],
        {
            "c1": {"customer_problem_text": "이번 달 결제 금액이 얼마인가요"},
            "c2": {"customer_problem_text": "납부 금액 확인하고 싶어요"},
            "c3": {"customer_problem_text": "청구 금액 결제가 맞나요"},
        },
    )

    assert label["name"] == "금액 결제 문의"
    assert label["objectActionJointCoverage"] == 1.0
    assert not flow_splitting._split_label_auto_acceptable(label)


def test_regenerated_label_removes_discourse_noise_from_action_object_frame() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2"],
        {
            "c1": {
                "customer_problem_text": "요금 확인하니까 결제 문의",
                "action_object_frame": {"object": "요금 확인하니까", "action": "결제", "confidence": 0.9},
            },
            "c2": {
                "customer_problem_text": "요금 결제 내역 확인",
                "action_object_frame": {"object": "요금", "action": "결제", "confidence": 0.85},
            },
        },
    )

    assert label["name"] == "요금 결제 문의"
    assert "확인하니까" not in label["name"]


def test_regenerated_label_downgrades_object_frame_when_only_discourse_object_remains() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2"],
        {
            "c1": {
                "customer_problem_text": "아니면 말을 결제 문의",
                "action_object_frame": {"object": "아니면 말을", "action": "결제", "confidence": 0.9},
            },
            "c2": {
                "customer_problem_text": "결제 문의",
                "action_object_frame": {"object": "말을", "action": "결제", "confidence": 0.85},
            },
        },
    )

    assert "아니면" not in label["name"]
    assert "말" not in label["name"]
    assert label["name"] == "결제 문의"


def test_regenerated_label_filters_question_tail_noise_from_action_object_frame() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2"],
        {
            "c1": {
                "customer_problem_text": "할인 있을까 뭐예 결제 문의",
                "action_object_frame": {"object": "할인 있을까 뭐예", "action": "결제", "confidence": 0.9},
            },
            "c2": {
                "customer_problem_text": "할인 결제 확인",
                "action_object_frame": {"object": "할인", "action": "결제", "confidence": 0.85},
            },
        },
    )

    assert label["name"] == "할인 결제 문의"
    assert "있을까" not in label["name"]
    assert "뭐예" not in label["name"]


def test_split_label_auto_acceptance_requires_strong_object_action_evidence() -> None:
    assert flow_splitting._split_label_auto_acceptable(
        {
            "name": "요금 결제 문의",
            "score": 0.82,
            "evidenceCoverage": 0.75,
            "objectActionJointCoverage": 0.75,
            "actionObjectValidity": 0.80,
            "specificity": 0.82,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "무제한 있다고 신청 문의",
            "score": 0.70,
            "evidenceCoverage": 0.40,
            "objectActionJointCoverage": 0.45,
            "actionObjectValidity": 0.76,
            "specificity": 1.0,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "정보들 정보확인 문의",
            "score": 0.83,
            "evidenceCoverage": 0.50,
            "objectActionJointCoverage": 1.0,
            "actionObjectValidity": 1.0,
            "specificity": 0.82,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "예약 정보확인 문의",
            "score": 0.83,
            "evidenceCoverage": 0.80,
            "objectActionJointCoverage": 0.90,
            "actionObjectValidity": 0.90,
            "specificity": 0.82,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "카드 품목별 한번 간단하게 확인 문의",
            "score": 0.83,
            "evidenceCoverage": 0.80,
            "objectActionJointCoverage": 0.90,
            "actionObjectValidity": 0.90,
            "specificity": 1.0,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "그랬는데 신청 문의",
            "score": 0.83,
            "evidenceCoverage": 0.80,
            "objectActionJointCoverage": 0.90,
            "actionObjectValidity": 0.90,
            "specificity": 0.82,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "요청해가지고 결제 문의",
            "score": 0.83,
            "evidenceCoverage": 0.80,
            "objectActionJointCoverage": 0.90,
            "actionObjectValidity": 0.90,
            "specificity": 0.82,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "그래가지고 결제 문의",
            "score": 0.83,
            "evidenceCoverage": 0.80,
            "objectActionJointCoverage": 0.90,
            "actionObjectValidity": 0.90,
            "specificity": 0.82,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "할인 나간다 신청 문의",
            "score": 0.83,
            "evidenceCoverage": 0.80,
            "objectActionJointCoverage": 0.90,
            "actionObjectValidity": 0.90,
            "specificity": 0.82,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "전에 선택약정 확인 문의",
            "score": 0.83,
            "evidenceCoverage": 0.80,
            "objectActionJointCoverage": 0.90,
            "actionObjectValidity": 0.90,
            "specificity": 0.82,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "거는 되네 결제 문의",
            "score": 0.83,
            "evidenceCoverage": 0.80,
            "objectActionJointCoverage": 0.90,
            "actionObjectValidity": 0.90,
            "specificity": 0.82,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "개월 없고 결제 문의",
            "score": 0.83,
            "evidenceCoverage": 0.80,
            "objectActionJointCoverage": 0.90,
            "actionObjectValidity": 0.90,
            "specificity": 0.82,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "요금제 조금 비싼 변경 문의",
            "score": 0.83,
            "evidenceCoverage": 0.80,
            "objectActionJointCoverage": 0.90,
            "actionObjectValidity": 0.90,
            "specificity": 0.82,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "개월 결제 문의",
            "score": 0.83,
            "evidenceCoverage": 0.80,
            "objectActionJointCoverage": 0.90,
            "actionObjectValidity": 0.90,
            "specificity": 0.82,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "카드 쓰면 환불 문의",
            "score": 0.83,
            "evidenceCoverage": 0.80,
            "objectActionJointCoverage": 0.90,
            "actionObjectValidity": 0.90,
            "specificity": 0.82,
        }
    )
    assert not flow_splitting._split_label_auto_acceptable(
        {
            "name": "요금 삼성카드 해요 변경 문의",
            "score": 0.83,
            "evidenceCoverage": 0.80,
            "objectActionJointCoverage": 0.90,
            "actionObjectValidity": 0.90,
            "specificity": 1.0,
        }
    )


def test_split_label_terms_compact_related_terms_and_speech_endings() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2"],
        {
            "c1": {"customer_problem_text": "카드 카드사 결제 문의"},
            "c2": {"customer_problem_text": "카드사 결제 변경됐어"},
        },
    )

    assert label["name"] == "카드사 결제 문의"
    assert "카드 카드사" not in label["name"]
    assert "됐어" not in label["name"]


def test_term_frequency_label_orders_object_before_action() -> None:
    label = flow_splitting._regenerated_split_label(
        ["c1", "c2"],
        {
            "c1": {"customer_problem_text": "결제 금액 확인 부탁드립니다"},
            "c2": {"customer_problem_text": "결제 금액이 얼마인가요"},
        },
    )

    assert label["name"] == "금액 결제 문의"


def test_review_safe_label_rejects_weak_information_check_surface_fragment() -> None:
    noisy_label = {
        "name": "문의하나 정보확인 문의",
        "score": 0.68,
        "evidenceCoverage": 0.67,
        "memberEvidenceCoverage": 0.67,
        "objectCoverage": 0.33,
        "actionCoverage": 1.0,
        "objectActionJointCoverage": 0.33,
        "actionObjectValidity": 0.80,
        "specificity": 0.82,
        "candidates": [
            {
                "name": "문의하나 정보확인 문의",
                "score": 0.68,
                "evidenceCoverage": 0.67,
                "objectActionJointCoverage": 0.33,
                "actionObjectValidity": 0.80,
                "source": "action_object_frame",
            }
        ],
    }

    label = flow_splitting._review_safe_generated_label(noisy_label, ["c1"], {}, "no_signal")

    assert label["name"] == "미분류 문의"
    assert label["candidates"][0]["source"] == "weak_label_flow_fallback"


def test_duplicate_fallback_name_does_not_repeat_review_suffix() -> None:
    label = flow_splitting._unique_duplicate_fallback_name(
        "결제 처리 문의",
        {"결제 처리 문의"},
    )

    assert label == "결제 처리 문의 2"
    assert "검토" not in label


def test_split_label_coverage_supports_canonical_action_aliases() -> None:
    candidate = flow_splitting._score_split_label_candidate(
        name="카드 사용 가능여부확인 문의",
        terms=["카드", "사용", "가능여부확인"],
        member_ids=["c1", "c2"],
        preprocessed_index={
            "c1": {"customer_problem_text": "카드를 사용할 수 있나요?"},
            "c2": {"customer_problem_text": "카드 사용 가능한가요?"},
        },
        source="action_object_frame",
        frame_candidate={
            "frame": {"object": "카드 사용", "action": "가능여부확인", "confidence": 0.9},
            "evidenceCoverage": 1.0,
        },
    )

    assert candidate["evidenceCoverage"] == 1.0
    assert candidate["memberEvidenceCoverage"] == 1.0
    assert candidate["actionCoverage"] == 1.0
    assert candidate["objectActionJointCoverage"] == 1.0


def test_novel_label_falls_back_to_flow_when_terms_are_weak() -> None:
    label = flow_splitting._stabilized_novel_label(
        {
            "source_type": "outlier_flow",
            "candidate_key": "outlier_flow:확인질문>정책안내:5",
            "suggested_name": "관측 흐름 미분류 문의",
        },
        {
            "name": "질문 생기면 문의",
            "score": 0.53,
            "evidenceCoverage": 0.33,
            "actionObjectValidity": 0.35,
            "candidates": [],
        },
    )

    assert label["name"] == "미분류 문의"
    assert label["score"] <= 0.45


def test_extend_unique_handles_malformed_existing_values_and_limit() -> None:
    target = {"values": "bad"}

    flow_splitting._extend_unique(target, "values", ["a", "b", "c"], limit=2)

    assert target["values"] == ["a", "b"]


def test_flow_splitting_helpers_handle_malformed_inputs(tmp_path: Path) -> None:
    runtime_config = PipelineRuntimeConfig(
        artifact_root=tmp_path,
        backend_base_url="http://backend:8080",
        callback_enabled=False,
    )
    context = StageContext(
        dag_id="dag",
        run_id="run",
        stage_name="flow_splitting",
        workspace_id=None,
        dataset_id=None,
        pipeline_job_id=None,
    )
    bad_json = tmp_path / "bad.json"
    bad_json.write_text("{not-json", encoding="utf-8")
    list_json = tmp_path / "list.json"
    list_json.write_text("[]", encoding="utf-8")
    preprocessing_dir = tmp_path / "dag" / "run" / "preprocessing"
    preprocessing_dir.mkdir(parents=True)
    (preprocessing_dir / "preprocessed_data.json").write_text(json.dumps({"conversations": {}}), encoding="utf-8")

    assert flow_splitting._read_preprocessed_index(runtime_config, context) == {}
    assert flow_splitting._string_list("not-list") == []
    with pytest.raises(PipelineStageError, match="Failed to read JSON artifact"):
        flow_splitting._read_json(bad_json)
    with pytest.raises(PipelineStageError, match="JSON artifact must be an object"):
        flow_splitting._read_json(list_json)
