from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pipeline.stages.evaluation import main as evaluation
from tests.helpers.artifacts import write_stage_manifest


def _write_manifest(tmp_path: Path, payload: dict[str, object] | None = None) -> Path:
    return write_stage_manifest(tmp_path / "manifest.json", payload=payload or {})


def _candidate_with_metrics(
    metrics: dict[str, object],
    *,
    block_reasons: list[str] | None = None,
) -> dict[str, object]:
    return {
        "schemaVersion": "1.0",
        "domainPackDraft": {"packKey": "fixture", "packName": "Fixture"},
        "intentDraft": {"intents": []},
        "workflowDraft": {"slots": [], "policies": [], "risks": [], "workflows": [], "intentSlotBindings": []},
        "evaluationInputs": metrics,
        "evaluationSummary": {
            "blockReasons": block_reasons or [],
            "qualityReviewReasons": [],
        },
    }


def _candidate_with_pairwise_members() -> dict[str, Any]:
    candidate = evaluation._build_development_candidate()
    graph_json = candidate["workflowDraft"]["workflows"][0]["graphJson"]
    candidate["intentDraft"]["intents"] = [
        {
            "intentCode": "INTENT_A",
            "name": "Intent A",
            "description": "Intent A",
            "taxonomyLevel": 1,
            "parentIntentCode": None,
            "sourceClusterRef": json.dumps({"segmentIds": ["caselet-a1", "caselet-a2"]}),
            "entryConditionJson": "{}",
            "evidenceJson": json.dumps({"exemplarConversationIds": ["caselet-a1"]}),
            "metaJson": "{}",
            "representativeCases": [{"conversationId": "caselet-a2"}],
        },
        {
            "intentCode": "INTENT_B",
            "name": "Intent B",
            "description": "Intent B",
            "taxonomyLevel": 1,
            "parentIntentCode": None,
            "sourceClusterRef": json.dumps({"segmentIds": ["caselet-b1"]}),
            "entryConditionJson": "{}",
            "evidenceJson": json.dumps({"exemplarConversationIds": ["caselet-b1"]}),
            "metaJson": "{}",
            "representativeCases": [],
        },
    ]
    candidate["workflowDraft"]["workflows"] = [
        {
            "workflowCode": "WORKFLOW_A",
            "name": "Workflow A",
            "description": "Workflow A",
            "graphJson": graph_json,
            "evidenceJson": json.dumps(
                [
                    {"type": "member_conv_id", "value": "caselet-a1"},
                    {"type": "member_conv_id", "value": "caselet-a2"},
                ]
            ),
            "metaJson": "{}",
            "intentCode": "INTENT_A",
            "isPrimary": True,
            "routeConditionJson": "{}",
        },
        {
            "workflowCode": "WORKFLOW_B",
            "name": "Workflow B",
            "description": "Workflow B",
            "graphJson": graph_json,
            "evidenceJson": json.dumps([{"type": "member_conv_id", "value": "caselet-b1"}]),
            "metaJson": "{}",
            "intentCode": "INTENT_B",
            "isPrimary": True,
            "routeConditionJson": "{}",
        },
    ]
    return candidate
