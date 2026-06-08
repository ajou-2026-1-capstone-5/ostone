from __future__ import annotations

import pytest

from pipeline.stages.flow_splitting import main as flow_splitting


def test_confidence_review_reasons_allow_clean_mid_confidence_sample_review() -> None:
    reasons = flow_splitting._review_reason_codes(
        confidence=0.72,
        components={
            "semantic": 0.72,
            "flow": 0.72,
            "evidence": 0.72,
            "label": 0.72,
            "support": 0.72,
            "safety": 1.0,
        },
        split_reason="no_signal",
        coverage_share=0.08,
        duplicate_label_count=1,
        low_quality_ratio=0.0,
    )

    assert reasons == []
    assert flow_splitting._review_tier(0.72, needs_review=False) == "sample_review"


def test_confidence_review_reasons_still_block_weak_evidence_above_threshold() -> None:
    reasons = flow_splitting._review_reason_codes(
        confidence=0.72,
        components={
            "semantic": 0.72,
            "flow": 0.72,
            "evidence": 0.45,
            "label": 0.72,
            "support": 0.72,
            "safety": 1.0,
        },
        split_reason="no_signal",
        coverage_share=0.08,
        duplicate_label_count=1,
        low_quality_ratio=0.0,
    )

    assert reasons == ["weak_evidence_support"]
    assert flow_splitting._review_tier(0.72, needs_review=True) == "human_review"


def test_confidence_review_reasons_route_label_only_weakness_to_sample_review() -> None:
    components = {
        "semantic": 0.72,
        "flow": 0.72,
        "evidence": 0.72,
        "label": 0.50,
        "support": 0.72,
        "safety": 1.0,
    }

    reasons = flow_splitting._review_reason_codes(
        confidence=0.72,
        components=components,
        split_reason="no_signal",
        coverage_share=0.08,
        duplicate_label_count=1,
        low_quality_ratio=0.0,
    )
    sample_reasons = flow_splitting._sample_review_reason_codes(
        components=components,
        duplicate_label_count=1,
    )

    assert reasons == []
    assert sample_reasons == ["weak_label_sample"]
    assert flow_splitting._review_tier(0.72, needs_review=False) == "sample_review"


def test_confidence_review_reasons_block_very_weak_label() -> None:
    reasons = flow_splitting._review_reason_codes(
        confidence=0.72,
        components={
            "semantic": 0.72,
            "flow": 0.72,
            "evidence": 0.72,
            "label": 0.35,
            "support": 0.72,
            "safety": 1.0,
        },
        split_reason="no_signal",
        coverage_share=0.08,
        duplicate_label_count=1,
        low_quality_ratio=0.0,
    )

    assert reasons == ["weak_or_duplicate_label"]


def test_confidence_uses_expanded_support_floor_for_compound_action_splits() -> None:
    member_ids = ["c1", "c2", "c3"]
    payload = flow_splitting._workflow_confidence_payload(
        {
            "member_conv_ids": member_ids,
            "exemplar_conv_ids": ["c1", "c2", "c3"],
            "keywords": ["결제", "금액"],
            "quality": {
                "interpretability_score": 0.8,
                "workflow_consistency_score": 0.8,
                "branching_explainability_score": 0.8,
            },
            "suggested_name": "결제 금액 문의",
            "label_score": 0.8,
            "label_evidence_coverage": 1.0,
            "label_action_object_validity": 0.8,
        },
        split_reason="resolved:no_signal|action:결제",
        preprocessed_index={
            conv_id: {"flow_events": ["확인질문", "해결"], "workflow_signal": {}} for conv_id in member_ids
        },
        total_member_count=30,
        min_split_size=5,
        duplicate_label_count=1,
    )

    assert payload["support_min_split_size"] == 4
    assert payload["workflow_confidence_components"]["support"] == pytest.approx(
        flow_splitting._support_confidence(member_ids, 4)
    )
    assert payload["workflow_confidence_components"]["evidence"] > flow_splitting._evidence_confidence(
        {"exemplar_conv_ids": ["c1", "c2", "c3"], "keywords": ["결제", "금액"]},
        member_ids,
        5,
    )


def test_semantic_confidence_uses_entrypoint_boundary_quality() -> None:
    weak_boundary = flow_splitting._semantic_confidence(
        {
            "quality": {
                "interpretability_score": 0.85,
                "workflow_consistency_score": 0.85,
                "branching_explainability_score": 0.85,
                "entrypoint_semantic_cohesion": 0.90,
                "entrypoint_semantic_distinctiveness": 0.05,
                "entrypoint_semantic_separation_margin": -0.02,
            }
        }
    )
    strong_boundary = flow_splitting._semantic_confidence(
        {
            "quality": {
                "interpretability_score": 0.85,
                "workflow_consistency_score": 0.85,
                "branching_explainability_score": 0.85,
                "entrypoint_semantic_cohesion": 0.90,
                "entrypoint_semantic_distinctiveness": 0.70,
                "entrypoint_semantic_separation_margin": 0.04,
            }
        }
    )

    assert weak_boundary < 0.85
    assert strong_boundary > weak_boundary


def test_weak_entrypoint_semantic_boundary_requires_review_reason() -> None:
    assert (
        flow_splitting._has_weak_entrypoint_semantic_boundary(
            {
                "entrypoint_semantic_quality": {
                    "distinctiveness": 0.12,
                    "separationMargin": -0.01,
                }
            }
        )
        is True
    )
    assert (
        flow_splitting._has_weak_entrypoint_semantic_boundary(
            {
                "entrypoint_semantic_quality": {
                    "distinctiveness": 0.28,
                    "separationMargin": 0.01,
                }
            }
        )
        is False
    )


def test_confidence_routes_clean_weak_semantic_boundary_to_sample_review() -> None:
    member_ids = ["c1", "c2", "c3", "c4", "c5"]
    payload = flow_splitting._workflow_confidence_payload(
        {
            "member_conv_ids": member_ids,
            "exemplar_conv_ids": member_ids[:3],
            "keywords": ["결제", "금액", "카드", "납부", "확인"],
            "quality": {
                "interpretability_score": 0.9,
                "workflow_consistency_score": 0.9,
                "branching_explainability_score": 0.9,
            },
            "entrypoint_semantic_quality": {
                "distinctiveness": 0.12,
                "separationMargin": -0.01,
            },
            "suggested_name": "결제 금액 문의",
            "label_score": 0.82,
            "label_evidence_coverage": 1.0,
            "label_action_object_validity": 0.8,
        },
        split_reason="no_signal",
        preprocessed_index={
            conv_id: {"flow_events": ["확인질문", "정책안내", "해결"], "workflow_signal": {}} for conv_id in member_ids
        },
        total_member_count=30,
        min_split_size=5,
        duplicate_label_count=1,
    )

    assert payload["workflow_confidence"] >= 0.70
    assert payload["needs_human_review"] is False
    assert "weak_semantic_boundary" not in payload["review_reason_codes"]
    assert payload["sample_review_reason_codes"] == ["weak_semantic_boundary_sample"]
    assert payload["review_tier"] == "sample_review"


def test_confidence_blocks_weak_semantic_boundary_when_other_hard_reason_exists() -> None:
    member_ids = ["c1", "c2", "c3", "c4", "c5"]
    payload = flow_splitting._workflow_confidence_payload(
        {
            "member_conv_ids": member_ids,
            "exemplar_conv_ids": member_ids[:3],
            "keywords": ["결제", "금액", "카드", "납부", "확인"],
            "quality": {
                "interpretability_score": 0.9,
                "workflow_consistency_score": 0.9,
                "branching_explainability_score": 0.9,
            },
            "entrypoint_semantic_quality": {
                "distinctiveness": 0.12,
                "separationMargin": -0.01,
            },
            "suggested_name": "결제 금액 문의",
            "label_score": 0.35,
            "label_evidence_coverage": 0.20,
            "label_action_object_validity": 0.8,
        },
        split_reason="no_signal",
        preprocessed_index={
            conv_id: {"flow_events": ["확인질문", "정책안내", "해결"], "workflow_signal": {}} for conv_id in member_ids
        },
        total_member_count=30,
        min_split_size=5,
        duplicate_label_count=1,
    )

    assert payload["needs_human_review"] is True
    assert "weak_or_duplicate_label" in payload["review_reason_codes"]
    assert "weak_semantic_boundary" in payload["review_reason_codes"]
