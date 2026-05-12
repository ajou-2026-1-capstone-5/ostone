package com.init.domainpack.application;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.domainpack.application.exception.DomainPackDraftRequestInvalidException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.application.exception.WorkflowActionNodePolicyRefInvalidCharsException;
import com.init.domainpack.application.exception.WorkflowDefinitionNotFoundException;
import com.init.domainpack.application.exception.WorkflowTransitionActionNotEditableException;
import com.init.domainpack.application.exception.WorkflowTransitionConditionNotEditableException;
import com.init.domainpack.application.exception.WorkflowTransitionNotFoundException;
import com.init.domainpack.application.exception.WorkflowTransitionOutcomeEmptyException;
import com.init.domainpack.application.exception.WorkflowTransitionOutcomeNotEditableException;
import com.init.domainpack.application.exception.WorkflowTransitionOutcomeStateInvalidCharsException;
import com.init.domainpack.application.exception.WorkflowTransitionPatchEmptyException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.shared.application.exception.BadRequestException;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class UpdateWorkflowTransitionUseCase {

  private static final Pattern TRANSITION_ID_PATTERN = Pattern.compile("[A-Za-z0-9_-]+");
  private static final Pattern MACHINE_CODE_PATTERN = Pattern.compile("[A-Za-z0-9_-]+");
  private static final String NODE_TYPE_ACTION = "ACTION";
  private static final String NODE_TYPE_DECISION = "DECISION";
  private static final String NODE_TYPE_TERMINAL = "TERMINAL";
  private static final String SHARED_TARGET_NOT_EDITABLE = "WORKFLOW_TRANSITION_TARGET_SHARED";

  private final DomainPackValidator validator;
  private final DomainPackVersionRepository versionRepository;
  private final WorkflowDefinitionRepository workflowRepository;

  public UpdateWorkflowTransitionUseCase(
      DomainPackValidator validator,
      DomainPackVersionRepository versionRepository,
      WorkflowDefinitionRepository workflowRepository) {
    this.validator = validator;
    this.versionRepository = versionRepository;
    this.workflowRepository = workflowRepository;
  }

  @Transactional
  public WorkflowTransitionDetail execute(UpdateWorkflowTransitionCommand command) {
    validateCommand(command);
    validator.validateWorkspaceAccess(command.workspaceId(), command.requesterId());
    validator.validateDomainPack(command.packId(), command.workspaceId());

    DomainPackVersion version =
        versionRepository
            .findByIdForUpdate(command.versionId())
            .orElseThrow(() -> new DomainPackVersionNotFoundException(command.versionId()));
    if (!version.getDomainPackId().equals(command.packId())) {
      throw new DomainPackVersionNotFoundException(command.versionId());
    }
    if (!DomainPackVersion.STATUS_DRAFT.equals(version.getLifecycleStatus())) {
      throw new BadRequestException("WORKFLOW_NOT_EDITABLE", "DRAFT 상태의 버전에서만 수정할 수 있습니다.");
    }

    WorkflowDefinition workflow =
        workflowRepository
            .findByIdAndDomainPackVersionIdForUpdate(command.workflowId(), command.versionId())
            .orElseThrow(() -> new WorkflowDefinitionNotFoundException(command.workflowId()));

    WorkflowGraphValidator.parseAndValidate(workflow.getGraphJson(), workflow.getWorkflowCode());
    WorkflowGraphDocument document =
        WorkflowGraphDocument.parse(workflow.getGraphJson(), workflow.getId());
    ObjectNode edge =
        document
            .findEdge(command.transitionId())
            .orElseThrow(() -> new WorkflowTransitionNotFoundException(command.transitionId()));
    ObjectNode fromNode = document.requireFromNode(edge);
    ObjectNode toNode = document.requireToNode(edge);

    applyPatch(command, document, edge, fromNode, toNode);

    String updatedGraphJson = document.toJson();
    WorkflowGraphValidator.ParsedGraph parsed =
        WorkflowGraphValidator.parseAndValidate(updatedGraphJson, workflow.getWorkflowCode());

    Set<String> policyRefs =
        parsed.nodes().stream()
            .filter(node -> NODE_TYPE_ACTION.equals(node.type()))
            .map(WorkflowGraphValidator.GraphNode::policyRef)
            .collect(Collectors.toCollection(LinkedHashSet::new));
    validator.validatePolicyCodes(command.versionId(), policyRefs);

    String initialState = WorkflowGraphValidator.extractInitialState(parsed);
    String terminalStatesJson;
    try {
      terminalStatesJson = WorkflowGraphValidator.extractTerminalStatesJson(parsed);
    } catch (IllegalStateException e) {
      throw new DomainPackDraftRequestInvalidException("Failed to serialize terminal states", e);
    }

    try {
      workflow.updateGraph(
          workflow.getName(),
          workflow.getDescription(),
          updatedGraphJson,
          initialState,
          terminalStatesJson);
    } catch (IllegalArgumentException e) {
      throw new BadRequestException("VALIDATION_ERROR", e.getMessage(), e);
    }

    workflowRepository.save(workflow);
    return document
        .findTransitionDetail(command.transitionId(), workflow.getDomainPackVersionId())
        .orElseThrow(() -> new WorkflowTransitionNotFoundException(command.transitionId()));
  }

  private void validateCommand(UpdateWorkflowTransitionCommand command) {
    if (!TRANSITION_ID_PATTERN.matcher(command.transitionId()).matches()) {
      throw new BadRequestException("VALIDATION_ERROR", "transitionId가 유효하지 않습니다.");
    }
    if (command.condition() == null && command.action() == null && command.outcome() == null) {
      throw new WorkflowTransitionPatchEmptyException();
    }
    if (command.outcome() != null
        && command.outcome().state() == null
        && command.outcome().label() == null) {
      throw new WorkflowTransitionOutcomeEmptyException();
    }
  }

  private void applyPatch(
      UpdateWorkflowTransitionCommand command,
      WorkflowGraphDocument document,
      ObjectNode edge,
      ObjectNode fromNode,
      ObjectNode toNode) {
    if (command.condition() != null) {
      applyConditionPatch(command, document, edge, fromNode);
    }
    if (command.action() != null) {
      applyActionPatch(command, document, toNode);
    }
    if (command.outcome() != null) {
      applyOutcomePatch(command, document, toNode);
    }
  }

  private void applyConditionPatch(
      UpdateWorkflowTransitionCommand command,
      WorkflowGraphDocument document,
      ObjectNode edge,
      ObjectNode fromNode) {
    if (!NODE_TYPE_DECISION.equals(nodeType(fromNode))) {
      throw new WorkflowTransitionConditionNotEditableException(command.transitionId());
    }
    document.putText(
        edge, "label", normalizeRequired(command.condition().label(), "condition.label", 255));
  }

  private void applyActionPatch(
      UpdateWorkflowTransitionCommand command, WorkflowGraphDocument document, ObjectNode toNode) {
    if (!NODE_TYPE_ACTION.equals(nodeType(toNode))) {
      throw new WorkflowTransitionActionNotEditableException(command.transitionId());
    }
    validateTargetNotShared(command, document, toNode);
    String policyRef = normalizeRequired(command.action().policyRef(), "action.policyRef", 100);
    if (!MACHINE_CODE_PATTERN.matcher(policyRef).matches()) {
      throw new WorkflowActionNodePolicyRefInvalidCharsException(
          command.workflowId(), toNode.path("id").asText());
    }
    document.putText(toNode, "policyRef", policyRef);
  }

  private void applyOutcomePatch(
      UpdateWorkflowTransitionCommand command, WorkflowGraphDocument document, ObjectNode toNode) {
    if (!NODE_TYPE_TERMINAL.equals(nodeType(toNode))) {
      throw new WorkflowTransitionOutcomeNotEditableException(command.transitionId());
    }
    validateTargetNotShared(command, document, toNode);
    if (command.outcome().state() != null) {
      applyOutcomeStatePatch(command, document, toNode);
    }
    if (command.outcome().label() != null) {
      document.putText(
          toNode, "label", normalizeRequired(command.outcome().label(), "outcome.label", 255));
    }
  }

  private String nodeType(ObjectNode node) {
    return trimToNull(node.path("type").asText(null));
  }

  private String trimToNull(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isBlank() ? null : trimmed;
  }

  private void applyOutcomeStatePatch(
      UpdateWorkflowTransitionCommand command, WorkflowGraphDocument document, ObjectNode toNode) {
    String state = normalizeRequired(command.outcome().state(), "outcome.state", 100);
    if (!MACHINE_CODE_PATTERN.matcher(state).matches()) {
      throw new WorkflowTransitionOutcomeStateInvalidCharsException(state);
    }
    document.putText(toNode, "state", state);
  }

  private void validateTargetNotShared(
      UpdateWorkflowTransitionCommand command, WorkflowGraphDocument document, ObjectNode toNode) {
    if (!document.hasSingleInboundEdge(toNode)) {
      throw new BadRequestException(
          SHARED_TARGET_NOT_EDITABLE,
          "공유 목적지 node를 가진 transition에서는 action/outcome을 수정할 수 없습니다: " + command.transitionId());
    }
  }

  private String normalizeRequired(String value, String fieldName, int maxLength) {
    if (value == null) {
      throw new BadRequestException("VALIDATION_ERROR", fieldName + "은 필수 항목입니다.");
    }
    String trimmed = value.trim();
    if (trimmed.isBlank()) {
      throw new BadRequestException("VALIDATION_ERROR", fieldName + "은 빈 값일 수 없습니다.");
    }
    if (trimmed.length() > maxLength) {
      throw new BadRequestException(
          "VALIDATION_ERROR", fieldName + "은 " + maxLength + "자 이하여야 합니다.");
    }
    return trimmed;
  }
}
