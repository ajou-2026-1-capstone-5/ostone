from __future__ import annotations

import json
from pathlib import Path
from typing import cast

from pipeline.stages.feedback_candidate_generation.main import run


def test_feedback_questions_include_caselet_review_context(monkeypatch, tmp_path: Path) -> None:
    artifact_root = tmp_path / "artifacts"
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")

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
        json.dumps(
            {
                "issueCaselets": [
                    {
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
                    },
                    {
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
                    },
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
    assert question["sourceClusterId"] == "0"
    assert questions["qualityKpis"]["questionTypeDistribution"] == {"WORKFLOW_BOUNDARY": 1}
    assert questions["qualityKpis"]["caseletRepeatRate"] == 0.0
    assert questions["qualityKpis"]["sourceClusterDominance"] == 1.0
    assert manifest["payload"]["metrics"]["qualityKpis"] == questions["qualityKpis"]


def test_low_confidence_cluster_questions_remain_intent_boundary(monkeypatch, tmp_path: Path) -> None:
    artifact_root = tmp_path / "artifacts"
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")

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
