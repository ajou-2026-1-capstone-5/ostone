from __future__ import annotations

import json
import os
from typing import Any

DEFAULT_KEYWORDS_PER_WORKFLOW = 5
DEFAULT_EXEMPLARS_PER_WORKFLOW = 3
DEFAULT_MEMBERS_PER_WORKFLOW = 10


def build_workflow_evidence(cluster: dict[str, Any]) -> list[dict[str, str]]:
    """Extract workflow evidence items from a cluster dict in deterministic order.

    Order: keyword entries → exemplar_conv_id entries → member_conv_id entries (exemplars excluded).
    """
    items: list[dict[str, str]] = []

    raw_keywords = cluster.get("keywords") or []
    raw_exemplars = cluster.get("exemplar_conv_ids") or []
    raw_members = cluster.get("member_conv_ids") or []

    keywords: list[Any] = raw_keywords if isinstance(raw_keywords, list) else []
    exemplar_conv_ids: list[Any] = raw_exemplars if isinstance(raw_exemplars, list) else []
    member_conv_ids: list[Any] = raw_members if isinstance(raw_members, list) else []

    keyword_cap = _resolve_cap("DRAFT_EVIDENCE_KEYWORDS_PER_WORKFLOW", DEFAULT_KEYWORDS_PER_WORKFLOW)
    exemplar_cap = _resolve_cap("DRAFT_EVIDENCE_EXEMPLARS_PER_WORKFLOW", DEFAULT_EXEMPLARS_PER_WORKFLOW)
    member_cap = _resolve_cap("DRAFT_EVIDENCE_MEMBERS_PER_WORKFLOW", DEFAULT_MEMBERS_PER_WORKFLOW)

    for kw in keywords[:keyword_cap]:
        if isinstance(kw, str) and kw:
            items.append({"type": "keyword", "value": kw})

    selected_exemplars: list[str] = []
    for cid in exemplar_conv_ids[:exemplar_cap]:
        if isinstance(cid, str) and cid:
            items.append({"type": "exemplar_conv_id", "value": cid})
            selected_exemplars.append(cid)

    exemplar_set = set(selected_exemplars)
    member_added = 0
    for cid in member_conv_ids:
        if member_added >= member_cap:
            break
        if not isinstance(cid, str) or not cid:
            continue
        if cid in exemplar_set:
            continue
        items.append({"type": "member_conv_id", "value": cid})
        member_added += 1

    return items


def serialize_evidence_json(items: list[dict[str, str]]) -> str:
    """Serialize evidence items to a JSON string (ensure_ascii=False to preserve Korean)."""
    return json.dumps(items, ensure_ascii=False)


def _resolve_cap(env_key: str, default: int) -> int:
    raw = os.getenv(env_key, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
        return value if value >= 0 else default
    except ValueError:
        return default
