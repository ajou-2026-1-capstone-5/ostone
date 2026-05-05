from __future__ import annotations

import json

import pytest

from pipeline.stages.draft_generation.workflow_evidence import (
    DEFAULT_EXEMPLARS_PER_WORKFLOW,
    DEFAULT_KEYWORDS_PER_WORKFLOW,
    DEFAULT_MEMBERS_PER_WORKFLOW,
    build_workflow_evidence,
    serialize_evidence_json,
)


def _cluster(
    keywords: object = None,
    exemplar_conv_ids: object = None,
    member_conv_ids: object = None,
) -> dict[str, object]:
    cluster: dict[str, object] = {"cluster_id": 0}
    if keywords is not None:
        cluster["keywords"] = keywords
    if exemplar_conv_ids is not None:
        cluster["exemplar_conv_ids"] = exemplar_conv_ids
    if member_conv_ids is not None:
        cluster["member_conv_ids"] = member_conv_ids
    return cluster


# ---------------------------------------------------------------------------
# build_workflow_evidence — all sources sufficient
# ---------------------------------------------------------------------------


def test_all_sources_sufficient_returns_capped_entries() -> None:
    cluster = _cluster(
        keywords=[f"kw{i}" for i in range(7)],
        exemplar_conv_ids=[f"ex-{i}" for i in range(5)],
        member_conv_ids=[f"mb-{i}" for i in range(13)],
    )

    items = build_workflow_evidence(cluster)

    keyword_items = [i for i in items if i["type"] == "keyword"]
    exemplar_items = [i for i in items if i["type"] == "exemplar_conv_id"]
    member_items = [i for i in items if i["type"] == "member_conv_id"]

    assert len(keyword_items) == DEFAULT_KEYWORDS_PER_WORKFLOW
    assert len(exemplar_items) == DEFAULT_EXEMPLARS_PER_WORKFLOW
    assert len(member_items) == DEFAULT_MEMBERS_PER_WORKFLOW
    assert len(items) == DEFAULT_KEYWORDS_PER_WORKFLOW + DEFAULT_EXEMPLARS_PER_WORKFLOW + DEFAULT_MEMBERS_PER_WORKFLOW


def test_item_format_has_type_and_value() -> None:
    cluster = _cluster(
        keywords=["환불"],
        exemplar_conv_ids=["conv-1"],
        member_conv_ids=["conv-2"],
    )

    items = build_workflow_evidence(cluster)

    assert items[0] == {"type": "keyword", "value": "환불"}
    assert items[1] == {"type": "exemplar_conv_id", "value": "conv-1"}
    assert items[2] == {"type": "member_conv_id", "value": "conv-2"}


# ---------------------------------------------------------------------------
# build_workflow_evidence — individual source empty
# ---------------------------------------------------------------------------


def test_missing_keywords_yields_zero_keyword_entries() -> None:
    cluster = _cluster(
        exemplar_conv_ids=["conv-1"],
        member_conv_ids=["conv-2"],
    )

    items = build_workflow_evidence(cluster)

    assert all(i["type"] != "keyword" for i in items)
    assert len([i for i in items if i["type"] == "exemplar_conv_id"]) == 1
    assert len([i for i in items if i["type"] == "member_conv_id"]) == 1


def test_empty_keywords_list_yields_zero_keyword_entries() -> None:
    cluster = _cluster(keywords=[], exemplar_conv_ids=["conv-1"])

    items = build_workflow_evidence(cluster)

    assert all(i["type"] != "keyword" for i in items)


def test_missing_exemplar_conv_ids_yields_zero_exemplar_entries() -> None:
    cluster = _cluster(keywords=["kw1"], member_conv_ids=["conv-m"])

    items = build_workflow_evidence(cluster)

    assert all(i["type"] != "exemplar_conv_id" for i in items)


def test_missing_member_conv_ids_yields_zero_member_entries() -> None:
    cluster = _cluster(keywords=["kw1"], exemplar_conv_ids=["conv-1"])

    items = build_workflow_evidence(cluster)

    assert all(i["type"] != "member_conv_id" for i in items)


def test_all_sources_empty_returns_empty_list() -> None:
    cluster = _cluster(keywords=[], exemplar_conv_ids=[], member_conv_ids=[])

    items = build_workflow_evidence(cluster)

    assert items == []


def test_no_fields_at_all_returns_empty_list() -> None:
    items = build_workflow_evidence({"cluster_id": 0})

    assert items == []


# ---------------------------------------------------------------------------
# build_workflow_evidence — exemplar / member dedup
# ---------------------------------------------------------------------------


def test_exemplar_deduped_from_members() -> None:
    shared_id = "conv-shared"
    cluster = _cluster(
        exemplar_conv_ids=[shared_id],
        member_conv_ids=[shared_id, "conv-other"],
    )

    items = build_workflow_evidence(cluster)

    exemplar_ids = [i["value"] for i in items if i["type"] == "exemplar_conv_id"]
    member_ids = [i["value"] for i in items if i["type"] == "member_conv_id"]

    assert shared_id in exemplar_ids
    assert shared_id not in member_ids
    assert "conv-other" in member_ids


def test_member_smaller_than_cap_returns_all_available() -> None:
    cluster = _cluster(
        exemplar_conv_ids=["ex-1"],
        member_conv_ids=["mb-1", "mb-2", "ex-1"],
    )

    items = build_workflow_evidence(cluster)

    member_ids = [i["value"] for i in items if i["type"] == "member_conv_id"]
    assert set(member_ids) == {"mb-1", "mb-2"}


# ---------------------------------------------------------------------------
# build_workflow_evidence — non-string / empty-string skip
# ---------------------------------------------------------------------------


def test_non_string_keyword_skipped() -> None:
    cluster = _cluster(
        keywords=[123, None, {"key": "val"}, "valid_kw"],
    )

    items = build_workflow_evidence(cluster)

    assert len(items) == 1
    assert items[0]["value"] == "valid_kw"


def test_empty_string_keyword_skipped() -> None:
    cluster = _cluster(keywords=["", "kw"])

    items = build_workflow_evidence(cluster)

    assert len(items) == 1
    assert items[0]["value"] == "kw"


def test_non_string_conv_id_skipped() -> None:
    cluster = _cluster(
        exemplar_conv_ids=[42, None, "valid-id"],
        member_conv_ids=[True, {}, "mb-valid"],
    )

    items = build_workflow_evidence(cluster)

    exemplar_ids = [i["value"] for i in items if i["type"] == "exemplar_conv_id"]
    member_ids = [i["value"] for i in items if i["type"] == "member_conv_id"]
    assert exemplar_ids == ["valid-id"]
    assert member_ids == ["mb-valid"]


def test_empty_string_conv_id_skipped() -> None:
    cluster = _cluster(
        exemplar_conv_ids=["", "ex-1"],
        member_conv_ids=["", "mb-1"],
    )

    items = build_workflow_evidence(cluster)

    assert [i["value"] for i in items if i["type"] == "exemplar_conv_id"] == ["ex-1"]
    assert [i["value"] for i in items if i["type"] == "member_conv_id"] == ["mb-1"]


def test_keywords_dict_schema_yields_zero_keyword_entries() -> None:
    cluster = _cluster(keywords={"key": "val"}, exemplar_conv_ids=["ex-1"])

    items = build_workflow_evidence(cluster)

    assert all(i["type"] != "keyword" for i in items)


# ---------------------------------------------------------------------------
# build_workflow_evidence — env override
# ---------------------------------------------------------------------------


def test_env_keyword_cap_override(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DRAFT_EVIDENCE_KEYWORDS_PER_WORKFLOW", "2")
    cluster = _cluster(keywords=["kw0", "kw1", "kw2", "kw3"])

    items = build_workflow_evidence(cluster)

    assert len([i for i in items if i["type"] == "keyword"]) == 2


def test_env_exemplar_cap_zero(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DRAFT_EVIDENCE_EXEMPLARS_PER_WORKFLOW", "0")
    cluster = _cluster(exemplar_conv_ids=["ex-1", "ex-2"])

    items = build_workflow_evidence(cluster)

    assert all(i["type"] != "exemplar_conv_id" for i in items)


def test_env_member_cap_zero(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DRAFT_EVIDENCE_MEMBERS_PER_WORKFLOW", "0")
    cluster = _cluster(member_conv_ids=["mb-1", "mb-2"])

    items = build_workflow_evidence(cluster)

    assert all(i["type"] != "member_conv_id" for i in items)


def test_env_negative_falls_back_to_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DRAFT_EVIDENCE_KEYWORDS_PER_WORKFLOW", "-1")
    cluster = _cluster(keywords=["kw0", "kw1", "kw2", "kw3", "kw4", "kw5"])

    items = build_workflow_evidence(cluster)

    assert len([i for i in items if i["type"] == "keyword"]) == DEFAULT_KEYWORDS_PER_WORKFLOW


def test_env_non_integer_falls_back_to_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DRAFT_EVIDENCE_KEYWORDS_PER_WORKFLOW", "abc")
    cluster = _cluster(keywords=["kw0", "kw1", "kw2", "kw3", "kw4", "kw5"])

    items = build_workflow_evidence(cluster)

    assert len([i for i in items if i["type"] == "keyword"]) == DEFAULT_KEYWORDS_PER_WORKFLOW


# ---------------------------------------------------------------------------
# build_workflow_evidence — determinism
# ---------------------------------------------------------------------------


def test_same_input_produces_same_output() -> None:
    cluster = _cluster(
        keywords=["환불", "결제", "취소"],
        exemplar_conv_ids=["ex-1", "ex-2"],
        member_conv_ids=["mb-1", "mb-2", "mb-3"],
    )

    result_a = build_workflow_evidence(cluster)
    result_b = build_workflow_evidence(cluster)

    assert result_a == result_b


def test_order_is_keyword_then_exemplar_then_member() -> None:
    cluster = _cluster(
        keywords=["kw"],
        exemplar_conv_ids=["ex"],
        member_conv_ids=["mb"],
    )

    items = build_workflow_evidence(cluster)

    types = [i["type"] for i in items]
    assert types == ["keyword", "exemplar_conv_id", "member_conv_id"]


# ---------------------------------------------------------------------------
# serialize_evidence_json
# ---------------------------------------------------------------------------


def test_serialize_empty_list_returns_empty_json_array() -> None:
    assert serialize_evidence_json([]) == "[]"


def test_serialize_korean_keyword_not_escaped() -> None:
    items = [{"type": "keyword", "value": "환불"}]
    result = serialize_evidence_json(items)
    assert "환불" in result
    assert "\\u" not in result


def test_serialize_round_trip() -> None:
    items = [
        {"type": "keyword", "value": "환불"},
        {"type": "exemplar_conv_id", "value": "conv-uuid-1"},
        {"type": "member_conv_id", "value": "conv-uuid-2"},
    ]

    serialized = serialize_evidence_json(items)
    parsed = json.loads(serialized)

    assert parsed == items


def test_serialize_top_n_cap_result_within_5000_chars() -> None:
    keywords = [f"keyword_{i:03d}" for i in range(DEFAULT_KEYWORDS_PER_WORKFLOW)]
    exemplars = [f"exemplar-conv-id-{i:03d}" for i in range(DEFAULT_EXEMPLARS_PER_WORKFLOW)]
    members = [f"member-conv-id-{i:03d}" for i in range(DEFAULT_MEMBERS_PER_WORKFLOW)]
    items = (
        [{"type": "keyword", "value": kw} for kw in keywords]
        + [{"type": "exemplar_conv_id", "value": ex} for ex in exemplars]
        + [{"type": "member_conv_id", "value": mb} for mb in members]
    )

    result = serialize_evidence_json(items)

    assert len(result) <= 5000
