from __future__ import annotations

import copy
import hashlib
import json
from typing import Any, cast

from pipeline.common.context import StageContext
from pipeline.common.exceptions import PipelineStageError

CALLBACK_DOMAIN_PACK = "domain-pack-drafts"
CALLBACK_INTENT = "intent-drafts"
CALLBACK_WORKFLOW = "workflow-drafts"
WORKFLOW_LIST_KEYS = (
    "slots",
    "policies",
    "risks",
    "workflows",
    "intentSlotBindings",
)


def build_external_event_id(dag_id: str, run_id: str, callback_type: str, scope: str | None = None) -> str:
    scoped_callback = f"{callback_type}:{scope}" if scope else callback_type
    candidate = f"{dag_id}:{run_id}:{scoped_callback}"
    if len(candidate) <= 255:
        return candidate
    canonical_payload = json.dumps(
        {"callback_type": callback_type, "dag_id": dag_id, "run_id": run_id, "scope": scope},
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    digest = hashlib.sha256(canonical_payload.encode("utf-8")).hexdigest()
    return f"airflow:{callback_type}:{digest}"


def build_domain_pack_payload(
    candidate: dict[str, Any],
    stage_context: StageContext,
    scope: str | None = None,
) -> dict[str, object]:
    domain_pack_draft = _required_object(candidate, "domainPackDraft")
    return {
        "externalEventId": build_external_event_id(
            stage_context.dag_id,
            stage_context.run_id,
            CALLBACK_DOMAIN_PACK,
            scope,
        ),
        "packKey": domain_pack_draft["packKey"],
        "packName": domain_pack_draft["packName"],
        "summaryJson": domain_pack_draft.get("summaryJson"),
    }


def build_intent_payload(
    candidate: dict[str, Any],
    stage_context: StageContext,
    domain_pack_version_id: int,
    scope: str | None = None,
) -> dict[str, object]:
    intent_draft = _required_object(candidate, "intentDraft")
    return {
        "externalEventId": build_external_event_id(
            stage_context.dag_id,
            stage_context.run_id,
            CALLBACK_INTENT,
            scope,
        ),
        "domainPackVersionId": domain_pack_version_id,
        "intents": copy.deepcopy(intent_draft["intents"]),
    }


def build_workflow_payload(
    candidate: dict[str, Any],
    stage_context: StageContext,
    domain_pack_version_id: int,
    scope: str | None = None,
    final_callback: bool = True,
) -> dict[str, object]:
    workflow_draft = _required_object(candidate, "workflowDraft")
    payload: dict[str, object] = {
        "externalEventId": build_external_event_id(
            stage_context.dag_id,
            stage_context.run_id,
            CALLBACK_WORKFLOW,
            scope,
        ),
        "domainPackVersionId": domain_pack_version_id,
        "finalCallback": final_callback,
    }
    for key in WORKFLOW_LIST_KEYS:
        payload[key] = copy.deepcopy(workflow_draft.get(key) or [])
    return payload


def _required_object(payload: dict[str, Any], key: str) -> dict[str, Any]:
    value = payload.get(key)
    if not isinstance(value, dict):
        raise PipelineStageError(f"{key} must be a JSON object.")
    return cast(dict[str, Any], value)
