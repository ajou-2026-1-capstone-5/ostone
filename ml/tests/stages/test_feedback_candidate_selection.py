from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any, cast

from pipeline.stages.feedback_candidate_generation.main import run
from pipeline.stages.feedback_candidate_generation.selection import (
    QuestionCandidate,
    collect_candidates,
    select_candidates,
)


def _entrypoint(
    entrypoint_id: str,
    source: str,
    confidence: float,
    exemplar: str,
    *,
    split_reason: str = "action:변경",
    label: float = 0.7,
    member_count: int = 8,
) -> dict[str, Any]:
    return {
        "entryPointId": entrypoint_id,
        "sourceClusterId": source,
        "confidence": confidence,
        "splitReason": split_reason,
        "memberCount": member_count,
        "exemplarConversationIds": [exemplar],
        "confidenceComponents": {"label": label},
    }


def _must_link_cluster(
    cluster_id: int,
    confidence: float,
    exemplars: list[str],
    *,
    label_score: float = 0.65,
    evidence_coverage: float = 0.4,
    split_key: str = "action:변경",
) -> dict[str, Any]:
    return {
        "cluster_id": cluster_id,
        "source_cluster_id": cluster_id,
        "workflow_entrypoint_id": f"entrypoint-{cluster_id}",
        "workflow_confidence": confidence,
        "label_score": label_score,
        "label_evidence_coverage": evidence_coverage,
        "flow_split_key": split_key,
        "cluster_size": 8,
        "exemplar_conv_ids": exemplars,
    }


def _write_run_fixture(
    artifact_root: Path,
    *,
    entrypoints: list[dict[str, Any]],
    clusters: list[dict[str, Any]],
) -> Path:
    base_dir = artifact_root / "domain_pack_generation" / "manual__run"
    flow_dir = base_dir / "flow_splitting"
    preprocessing_dir = base_dir / "preprocessing"
    flow_dir.mkdir(parents=True)
    preprocessing_dir.mkdir(parents=True)
    (flow_dir / "clusters.json").write_text(json.dumps({"clusters": clusters}), encoding="utf-8")
    (flow_dir / "workflow_entrypoints.json").write_text(
        json.dumps({"workflowEntryPoints": entrypoints}),
        encoding="utf-8",
    )
    caselet_ids = {
        caselet_id for entrypoint in entrypoints for caselet_id in entrypoint.get("exemplarConversationIds", [])
    } | {caselet_id for cluster in clusters for caselet_id in cluster.get("exemplar_conv_ids", [])}
    (preprocessing_dir / "preprocessed_data.json").write_text(
        json.dumps(
            {
                "issueCaselets": [
                    {"caseletId": caselet_id, "customerIssueText": f"{caselet_id} 문의"}
                    for caselet_id in sorted(caselet_ids)
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
                "pipeline_job_id": "42",
            }
        ),
        encoding="utf-8",
    )
    return upstream_manifest


def _run_stage(monkeypatch, tmp_path: Path, entrypoints, clusters) -> tuple[dict[str, Any], dict[str, Any], Path]:
    artifact_root = tmp_path / "artifacts"
    monkeypatch.setenv("PIPELINE_ARTIFACT_ROOT", str(artifact_root))
    monkeypatch.setenv("PIPELINE_BACKEND_BASE_URL", "http://backend:8080")
    upstream_manifest = _write_run_fixture(artifact_root, entrypoints=entrypoints, clusters=clusters)

    result = run(str(upstream_manifest))

    output_dir = Path(cast(str, result["artifact_manifest_path"])).parent
    questions_payload = json.loads((output_dir / "feedback_review_questions.json").read_text(encoding="utf-8"))
    manifest = json.loads((output_dir / "manifest.json").read_text(encoding="utf-8"))
    return questions_payload, manifest, output_dir


def test_one_source_cluster_cannot_monopolize_default_question_slots(monkeypatch, tmp_path: Path) -> None:
    """job 42 증상 축소 재현: 큰 source cluster 하나가 12개 질문 슬롯을 독식하던 분포."""
    entrypoints = [
        _entrypoint("entrypoint-0", "1", 0.40, "90100#issue-01"),
        _entrypoint("entrypoint-1", "1", 0.45, "90101#issue-01"),
        _entrypoint("entrypoint-2", "1", 0.50, "90102#issue-01"),
        _entrypoint("entrypoint-3", "1", 0.55, "90103#issue-01"),
        _entrypoint("entrypoint-4", "1", 0.58, "90104#issue-01"),
        _entrypoint("entrypoint-5", "2", 0.52, "90200#issue-01"),
        _entrypoint("entrypoint-6", "2", 0.60, "90201#issue-01"),
        _entrypoint("entrypoint-7", "2", 0.65, "90202#issue-01"),
        _entrypoint("entrypoint-8", "3", 0.55, "90300#issue-01", split_reason="mixed_residual"),
        _entrypoint("entrypoint-9", "3", 0.57, "90301#issue-01", split_reason="mixed_residual"),
    ]
    clusters = [
        _must_link_cluster(20, 0.42, ["90400#issue-01", "90401#issue-01"]),
        _must_link_cluster(21, 0.46, ["90402#issue-01", "90403#issue-01"]),
        _must_link_cluster(22, 0.50, ["90404#issue-01", "90405#issue-01"]),
        _must_link_cluster(23, 0.54, ["90406#issue-01", "90407#issue-01"]),
    ]

    questions_payload, manifest, output_dir = _run_stage(monkeypatch, tmp_path, entrypoints, clusters)
    questions = questions_payload["questions"]

    workflow_questions = [question for question in questions if question["questionType"] == "WORKFLOW_BOUNDARY"]
    intent_questions = [question for question in questions if question["questionType"] == "INTENT_BOUNDARY"]
    source_counts = Counter(question["sourceClusterId"] for question in workflow_questions)
    assert max(source_counts.values()) <= 3
    assert len(source_counts) >= 2

    caselet_counts = Counter(
        caselet_id for question in questions for caselet_id in (question["sourceId"], question["targetId"])
    )
    assert max(caselet_counts.values()) <= 2

    assert len(intent_questions) == 4
    assert all(question["priority"] == "NORMAL" for question in intent_questions)

    low_priority_indexes = [index for index, question in enumerate(questions) if question["priority"] == "LOW"]
    assert low_priority_indexes
    assert all(question["sourceClusterId"] == "3" for question in (questions[index] for index in low_priority_indexes))
    assert min(low_priority_indexes) > max(
        index for index, question in enumerate(questions) if question["priority"] != "LOW"
    )

    selection_metrics = json.loads((output_dir / "feedback_selection_metrics.json").read_text(encoding="utf-8"))
    assert selection_metrics["schemaVersion"] == "feedback-selection-metrics.v1"
    assert selection_metrics["budgets"] == {"mustLink": 4, "cannotLink": 8}
    assert selection_metrics["selectedCounts"]["total"] == len(questions)
    assert selection_metrics["selectedCounts"]["mustLink"] == 4
    assert selection_metrics["selectedCounts"]["weak"] == len(low_priority_indexes)
    assert selection_metrics["weakReasonCounts"]["mixed_split_reason"] >= 1
    assert manifest["payload"]["reportPath"] == "feedback_selection_metrics.json"
    assert manifest["payload"]["metrics"]["selection"]["selectedCounts"]["total"] == len(questions)


def test_weak_only_candidates_still_fill_questions_with_low_priority(monkeypatch, tmp_path: Path) -> None:
    entrypoints = [
        _entrypoint("entrypoint-0", "9", 0.50, "90900#issue-01", split_reason="mixed_residual"),
        _entrypoint("entrypoint-1", "9", 0.55, "90901#issue-01", split_reason="mixed_residual"),
        _entrypoint("entrypoint-2", "9", 0.60, "90902#issue-01", split_reason="mixed_residual"),
    ]

    questions_payload, _manifest, output_dir = _run_stage(monkeypatch, tmp_path, entrypoints, clusters=[])
    questions = questions_payload["questions"]

    assert len(questions) == 3
    assert all(question["priority"] == "LOW" for question in questions)
    assert all(question["questionType"] == "WORKFLOW_BOUNDARY" for question in questions)

    selection_metrics = json.loads((output_dir / "feedback_selection_metrics.json").read_text(encoding="utf-8"))
    assert selection_metrics["selectedCounts"]["weak"] == 3
    assert selection_metrics["budgets"]["mustLink"] == 0


def _candidate(
    *,
    kind: str = "cannot_link",
    source: str = "1",
    cluster_id: str = "",
    source_id: str = "a",
    target_id: str = "b",
    score: float = 0.5,
    weak: tuple[str, ...] = (),
) -> QuestionCandidate:
    return QuestionCandidate(
        kind=kind,
        source_cluster_id=source,
        cluster_id=cluster_id,
        source_id=source_id,
        target_id=target_id,
        member_total=10,
        confidence=0.5,
        score=score,
        weak_reasons=weak,
    )


def test_select_uses_full_limit_when_no_must_link_candidates() -> None:
    candidates = [
        _candidate(source=str(source), source_id=f"s-{source}-{index}", target_id=f"t-{source}-{index}", score=0.9)
        for source in range(4)
        for index in range(3)
    ]

    result = select_candidates(candidates, limit=12)

    assert len(result.selected) == 12
    assert result.metrics["budgets"]["mustLink"] == 0


def test_select_reserves_must_link_budget_against_higher_scoring_cannot_link() -> None:
    cannot_link = [
        _candidate(source=str(source), source_id=f"s-{source}-{index}", target_id=f"t-{source}-{index}", score=0.9)
        for source in range(3)
        for index in range(3)
    ]
    must_link = [
        _candidate(
            kind="must_link",
            source=f"m-{index}",
            cluster_id=f"m-{index}",
            source_id=f"ms-{index}",
            target_id=f"mt-{index}",
            score=0.1,
        )
        for index in range(4)
    ]

    result = select_candidates(cannot_link + must_link, limit=12)

    kind_counts = Counter(candidate.kind for candidate in result.selected)
    assert kind_counts["must_link"] == 4
    assert kind_counts["cannot_link"] == 8


def test_select_lets_must_link_exceed_reserved_budget_when_no_cannot_link() -> None:
    must_link = [
        _candidate(
            kind="must_link",
            source=f"m-{index}",
            cluster_id=f"m-{index}",
            source_id=f"ms-{index}",
            target_id=f"mt-{index}",
            score=0.5,
        )
        for index in range(6)
    ]

    result = select_candidates(must_link, limit=12)

    assert len(result.selected) == 6
    assert result.metrics["budgets"]["mustLink"] == 4


def test_select_caps_repeated_caselet_exposure() -> None:
    candidates = [
        _candidate(source=str(source), source_id="repeated", target_id=f"t-{source}", score=0.9) for source in range(3)
    ]

    result = select_candidates(candidates, limit=12)

    assert len(result.selected) == 2
    assert result.metrics["skippedCounts"]["caseletExposureCap"] == 1
    assert result.metrics["maxCaseletExposure"] == 2


def test_select_orders_weak_candidates_after_strong_ones() -> None:
    strong = _candidate(source="1", source_id="s1", target_id="t1", score=0.1)
    weak = _candidate(source="2", source_id="s2", target_id="t2", score=0.9, weak=("mixed_split_reason",))

    result = select_candidates([weak, strong], limit=12)

    assert [candidate.is_weak for candidate in result.selected] == [False, True]


def test_select_is_deterministic_for_reversed_input_order() -> None:
    candidates = [
        _candidate(source=str(source), source_id=f"s-{source}-{index}", target_id=f"t-{source}-{index}", score=0.5)
        for source in range(4)
        for index in range(3)
    ]

    forward = select_candidates(list(candidates), limit=6)
    reversed_input = select_candidates(list(reversed(candidates)), limit=6)

    assert forward.selected == reversed_input.selected


def test_diagonal_pair_pool_reaches_source_cap_despite_caselet_cap() -> None:
    entrypoints = [
        _entrypoint(f"entrypoint-{index}", "1", 0.3 + 0.1 * index, f"e{index}#issue-01") for index in range(6)
    ]

    candidates = collect_candidates(entrypoints, [], limit=12)
    result = select_candidates(candidates, limit=12)

    assert len(result.selected) == 3


def test_collect_marks_low_label_confidence_and_zero_evidence_as_weak() -> None:
    entrypoints = [
        _entrypoint("entrypoint-0", "1", 0.50, "a#issue-01", label=0.2),
        _entrypoint("entrypoint-1", "1", 0.55, "b#issue-01"),
    ]
    clusters = [
        {
            "cluster_id": 1,
            "workflow_entrypoint_id": "entrypoint-1",
            "flow_split_key": "action:변경",
            "label_score": 0.7,
            "label_evidence_coverage": 0.0,
        },
        _must_link_cluster(7, 0.45, ["c#issue-01", "d#issue-01"], label_score=0.2),
    ]

    candidates = collect_candidates(entrypoints, clusters, limit=12)

    pair = next(candidate for candidate in candidates if candidate.kind == "cannot_link")
    assert "low_label_confidence" in pair.weak_reasons
    assert "zero_label_evidence_coverage" in pair.weak_reasons
    must = next(candidate for candidate in candidates if candidate.kind == "must_link")
    assert must.weak_reasons == ("low_label_confidence",)
