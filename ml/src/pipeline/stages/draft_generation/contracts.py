from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pipeline.common.exceptions import PipelineStageError

SCHEMA_VERSION = "1.0"


@dataclass(frozen=True)
class ClustersArtifact:
    payload: dict[str, Any]
    clusters: list[dict[str, Any]]
    source_path: Path

    @classmethod
    def from_payload(cls, payload: dict[str, Any], source_path: Path) -> ClustersArtifact:
        clusters = _contract_required_list(payload, "clusters.json", "clusters", source_path)
        typed_clusters = [
            _contract_required_object(cluster, "clusters.json", f"clusters[{index}]", source_path)
            for index, cluster in enumerate(clusters)
        ]
        return cls(payload=payload, clusters=typed_clusters, source_path=source_path)


@dataclass(frozen=True)
class PreprocessedArtifact:
    conversations: list[dict[str, Any]]
    issue_caselets: list[dict[str, Any]]
    source_path: Path

    @classmethod
    def from_payload(cls, payload: dict[str, Any], source_path: Path) -> PreprocessedArtifact:
        conversations = _contract_required_list(payload, "preprocessed_data.json", "conversations", source_path)
        typed_conversations = [
            _contract_required_object(item, "preprocessed_data.json", f"conversations[{index}]", source_path)
            for index, item in enumerate(conversations)
        ]
        caselets = payload.get("issueCaselets", [])
        if caselets is None:
            caselets = []
        if not isinstance(caselets, list):
            raise _contract_error("preprocessed_data.json", "issueCaselets", "must be a list when present", source_path)
        typed_caselets = [
            _contract_required_object(item, "preprocessed_data.json", f"issueCaselets[{index}]", source_path)
            for index, item in enumerate(caselets)
        ]
        return cls(conversations=typed_conversations, issue_caselets=typed_caselets, source_path=source_path)

    def conversation_index(self) -> dict[str, dict[str, Any]]:
        index: dict[str, dict[str, Any]] = {}
        for position, conversation in enumerate(self.conversations):
            conversation_id = conversation.get("id")
            if not isinstance(conversation_id, str) or not conversation_id:
                raise _contract_error(
                    "preprocessed_data.json",
                    f"conversations[{position}].id",
                    "must be a non-empty string",
                    self.source_path,
                )
            index[conversation_id] = conversation
        for position, caselet in enumerate(self.issue_caselets):
            caselet_id = caselet.get("caseletId")
            if not isinstance(caselet_id, str) or not caselet_id:
                raise _contract_error(
                    "preprocessed_data.json",
                    f"issueCaselets[{position}].caseletId",
                    "must be a non-empty string",
                    self.source_path,
                )
            index[caselet_id] = _caselet_index_row(caselet)
        return index


@dataclass(frozen=True)
class ProcessedWorkflow:
    workflow: dict[str, Any]
    keyword_count: int
    exemplar_count: int
    member_count: int
    is_empty_evidence: bool
    signal: dict[str, Any]
    path_support: float
    precision: float
    specificity: float
    graph_specific_metrics: dict[str, int | bool]


@dataclass(frozen=True)
class WorkflowDraftArtifact:
    slots: list[dict[str, Any]]
    policies: list[dict[str, Any]]
    risks: list[dict[str, Any]]
    workflows: list[dict[str, Any]]
    intent_slot_bindings: list[dict[str, Any]]

    @classmethod
    def from_payload(cls, payload: dict[str, Any], field_path: str = "workflowDraft") -> WorkflowDraftArtifact:
        typed_lists = {
            key: [
                _contract_required_object(item, "candidate.json", f"{field_path}.{key}[{index}]", None)
                for index, item in enumerate(
                    _contract_required_list(payload, "candidate.json", f"{field_path}.{key}", None)
                )
            ]
            for key in ("slots", "policies", "risks", "workflows", "intentSlotBindings")
        }
        return cls(
            slots=typed_lists["slots"],
            policies=typed_lists["policies"],
            risks=typed_lists["risks"],
            workflows=typed_lists["workflows"],
            intent_slot_bindings=typed_lists["intentSlotBindings"],
        )

    def to_json_dict(self) -> dict[str, Any]:
        return {
            "slots": self.slots,
            "policies": self.policies,
            "risks": self.risks,
            "workflows": self.workflows,
            "intentSlotBindings": self.intent_slot_bindings,
        }


@dataclass(frozen=True)
class DraftGenerationCandidateArtifact:
    domain_pack_draft: dict[str, Any]
    intents: list[dict[str, Any]]
    workflow_draft: WorkflowDraftArtifact
    evaluation_inputs: dict[str, Any]
    schema_version: str = SCHEMA_VERSION

    def to_json_dict(self) -> dict[str, Any]:
        if self.schema_version != SCHEMA_VERSION:
            raise PipelineStageError(f"candidate.json schemaVersion must be '{SCHEMA_VERSION}'.")
        _contract_required_object(self.domain_pack_draft, "candidate.json", "domainPackDraft", None)
        _contract_required_list({"intents": self.intents}, "candidate.json", "intentDraft.intents", None)
        _contract_required_object(self.evaluation_inputs, "candidate.json", "evaluationInputs", None)
        return {
            "schemaVersion": self.schema_version,
            "domainPackDraft": self.domain_pack_draft,
            "intentDraft": {
                "intents": self.intents,
            },
            "workflowDraft": self.workflow_draft.to_json_dict(),
            "evaluationInputs": self.evaluation_inputs,
        }


def _contract_required_object(
    value: object,
    artifact_name: str,
    field_path: str,
    source_path: Path | None,
) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    raise _contract_error(artifact_name, field_path, "must be a JSON object", source_path)


def _contract_required_list(
    payload: dict[str, Any],
    artifact_name: str,
    field_path: str,
    source_path: Path | None,
) -> list[Any]:
    key = field_path.rsplit(".", maxsplit=1)[-1]
    value = payload.get(key)
    if isinstance(value, list):
        return value
    raise _contract_error(artifact_name, field_path, "must be a list", source_path)


def _contract_error(
    artifact_name: str,
    field_path: str,
    message: str,
    source_path: Path | None,
) -> PipelineStageError:
    location = f": {source_path}" if source_path is not None else ""
    return PipelineStageError(f"{artifact_name} field '{field_path}' {message}{location}")


def _caselet_index_row(caselet: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": caselet.get("caseletId", ""),
        "source_conversation_id": caselet.get("conversationId"),
        "turn_start": caselet.get("turnStart"),
        "turn_end": caselet.get("turnEnd"),
        "evidence_turn_ids": caselet.get("evidenceTurnIds", []),
        "canonical_text": caselet.get("canonicalText", ""),
        "customer_problem_text": caselet.get("customerIssueText", ""),
        "agent_resolution_text": caselet.get("agentResolutionText", ""),
        "agent_action_text": caselet.get("agentActionText", ""),
        "ended_status": caselet.get("outcome"),
        "flow_events": caselet.get("flowEvents", []),
        "action_object_frame": caselet.get("actionObjectFrame", {}),
        "workflow_signal": caselet.get("workflowSignal", {}),
        "source_quality_flags": caselet.get("sourceQualityFlags", []),
        "filtered": caselet.get("filtered") is True,
        "quality_score": caselet.get("qualityScore"),
    }
