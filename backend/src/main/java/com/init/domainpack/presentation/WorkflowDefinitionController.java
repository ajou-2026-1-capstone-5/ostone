package com.init.domainpack.presentation;

import com.fasterxml.jackson.databind.JsonNode;
import com.init.domainpack.application.GetWorkflowDefinitionListQuery;
import com.init.domainpack.application.GetWorkflowDefinitionListUseCase;
import com.init.domainpack.application.GetWorkflowDefinitionQuery;
import com.init.domainpack.application.GetWorkflowDefinitionUseCase;
import com.init.domainpack.application.GetWorkflowTransitionListQuery;
import com.init.domainpack.application.GetWorkflowTransitionListUseCase;
import com.init.domainpack.application.GetWorkflowTransitionQuery;
import com.init.domainpack.application.GetWorkflowTransitionUseCase;
import com.init.domainpack.application.UpdateWorkflowCommand;
import com.init.domainpack.application.UpdateWorkflowTransitionCommand;
import com.init.domainpack.application.UpdateWorkflowTransitionUseCase;
import com.init.domainpack.application.UpdateWorkflowUseCase;
import com.init.domainpack.application.WorkflowDefinitionDetail;
import com.init.domainpack.application.WorkflowDefinitionSummary;
import com.init.domainpack.application.WorkflowTransitionDetail;
import com.init.domainpack.presentation.dto.UpdateWorkflowRequest;
import com.init.domainpack.presentation.dto.UpdateWorkflowTransitionRequest;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.presentation.AuthenticationUtils;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(
    "/api/v1/workspaces/{workspaceId}/domain-packs/{packId}/versions/{versionId}/workflows")
public class WorkflowDefinitionController {

  private final GetWorkflowDefinitionListUseCase listUseCase;
  private final GetWorkflowDefinitionUseCase detailUseCase;
  private final UpdateWorkflowUseCase updateUseCase;
  private final GetWorkflowTransitionUseCase transitionUseCase;
  private final GetWorkflowTransitionListUseCase transitionListUseCase;
  private final UpdateWorkflowTransitionUseCase updateTransitionUseCase;

  public WorkflowDefinitionController(
      GetWorkflowDefinitionListUseCase listUseCase,
      GetWorkflowDefinitionUseCase detailUseCase,
      UpdateWorkflowUseCase updateUseCase,
      GetWorkflowTransitionUseCase transitionUseCase,
      GetWorkflowTransitionListUseCase transitionListUseCase,
      UpdateWorkflowTransitionUseCase updateTransitionUseCase) {
    this.listUseCase = listUseCase;
    this.detailUseCase = detailUseCase;
    this.updateUseCase = updateUseCase;
    this.transitionUseCase = transitionUseCase;
    this.transitionListUseCase = transitionListUseCase;
    this.updateTransitionUseCase = updateTransitionUseCase;
  }

  @GetMapping
  public ResponseEntity<List<WorkflowDefinitionSummary>> listWorkflows(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @PathVariable Long versionId,
      @RequestParam(value = "intentDefinitionId", required = false) Long intentDefinitionId,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    List<WorkflowDefinitionSummary> result =
        listUseCase.execute(
            new GetWorkflowDefinitionListQuery(
                workspaceId, packId, versionId, userId, intentDefinitionId));
    return ResponseEntity.ok(result);
  }

  @GetMapping("/{workflowId}")
  public ResponseEntity<WorkflowDefinitionDetail> getWorkflow(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @PathVariable Long versionId,
      @PathVariable Long workflowId,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    WorkflowDefinitionDetail result =
        detailUseCase.execute(
            new GetWorkflowDefinitionQuery(workspaceId, packId, versionId, workflowId, userId));
    return ResponseEntity.ok(result);
  }

  @GetMapping("/{workflowId}/transitions")
  public ResponseEntity<List<WorkflowTransitionDetail>> listTransitions(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @PathVariable Long versionId,
      @PathVariable Long workflowId,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(
        transitionListUseCase.execute(
            new GetWorkflowTransitionListQuery(
                workspaceId, packId, versionId, workflowId, userId)));
  }

  @GetMapping("/{workflowId}/transitions/{transitionId}")
  public ResponseEntity<WorkflowTransitionDetail> getTransition(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @PathVariable Long versionId,
      @PathVariable Long workflowId,
      @PathVariable String transitionId,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(
        transitionUseCase.execute(
            new GetWorkflowTransitionQuery(
                workspaceId, packId, versionId, workflowId, transitionId, userId)));
  }

  @PatchMapping("/{workflowId}")
  public ResponseEntity<WorkflowDefinitionDetail> updateWorkflow(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @PathVariable Long versionId,
      @PathVariable Long workflowId,
      @Valid @RequestBody UpdateWorkflowRequest request,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    String graphJsonStr = request.graphJson().toString();
    WorkflowDefinitionDetail result =
        updateUseCase.execute(
            new UpdateWorkflowCommand(
                workspaceId,
                packId,
                versionId,
                workflowId,
                userId,
                request.name(),
                request.description(),
                graphJsonStr));
    return ResponseEntity.ok(result);
  }

  @PatchMapping("/{workflowId}/transitions/{transitionId}")
  public ResponseEntity<WorkflowTransitionDetail> updateTransition(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @PathVariable Long versionId,
      @PathVariable Long workflowId,
      @PathVariable String transitionId,
      @RequestBody JsonNode requestBody,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    UpdateWorkflowTransitionRequest request = parseTransitionPatchRequest(requestBody);
    UpdateWorkflowTransitionCommand command =
        new UpdateWorkflowTransitionCommand(
            workspaceId,
            packId,
            versionId,
            workflowId,
            transitionId,
            userId,
            toConditionCommand(request.condition()),
            toActionCommand(request.action()),
            toOutcomeCommand(request.outcome()));
    WorkflowTransitionDetail result = updateTransitionUseCase.execute(command);
    return ResponseEntity.ok(result);
  }

  private UpdateWorkflowTransitionCommand.ConditionPatch toConditionCommand(
      UpdateWorkflowTransitionRequest.ConditionPatch condition) {
    if (condition == null) {
      return null;
    }
    return new UpdateWorkflowTransitionCommand.ConditionPatch(condition.label());
  }

  private UpdateWorkflowTransitionCommand.ActionPatch toActionCommand(
      UpdateWorkflowTransitionRequest.ActionPatch action) {
    if (action == null) {
      return null;
    }
    return new UpdateWorkflowTransitionCommand.ActionPatch(action.policyRef());
  }

  private UpdateWorkflowTransitionCommand.OutcomePatch toOutcomeCommand(
      UpdateWorkflowTransitionRequest.OutcomePatch outcome) {
    if (outcome == null) {
      return null;
    }
    return new UpdateWorkflowTransitionCommand.OutcomePatch(outcome.state(), outcome.label());
  }

  private UpdateWorkflowTransitionRequest parseTransitionPatchRequest(JsonNode body) {
    if (body == null || !body.isObject()) {
      throw validationError("요청 본문은 JSON object여야 합니다.");
    }
    return new UpdateWorkflowTransitionRequest(
        parseConditionPatch(body), parseActionPatch(body), parseOutcomePatch(body));
  }

  private UpdateWorkflowTransitionRequest.ConditionPatch parseConditionPatch(JsonNode body) {
    if (!body.has("condition")) {
      return null;
    }
    JsonNode section = requireObjectSection(body, "condition");
    return new UpdateWorkflowTransitionRequest.ConditionPatch(
        requireTextField(section, "condition.label", "label", 255));
  }

  private UpdateWorkflowTransitionRequest.ActionPatch parseActionPatch(JsonNode body) {
    if (!body.has("action")) {
      return null;
    }
    JsonNode section = requireObjectSection(body, "action");
    return new UpdateWorkflowTransitionRequest.ActionPatch(
        requireTextField(section, "action.policyRef", "policyRef", 100));
  }

  private UpdateWorkflowTransitionRequest.OutcomePatch parseOutcomePatch(JsonNode body) {
    if (!body.has("outcome")) {
      return null;
    }
    JsonNode section = requireObjectSection(body, "outcome");
    return new UpdateWorkflowTransitionRequest.OutcomePatch(
        optionalTextField(section, "outcome.state", "state", 100),
        optionalTextField(section, "outcome.label", "label", 255));
  }

  private JsonNode requireObjectSection(JsonNode body, String sectionName) {
    JsonNode section = body.get(sectionName);
    if (section == null || section.isNull() || !section.isObject()) {
      throw validationError(sectionName + "은 JSON object여야 합니다.");
    }
    return section;
  }

  private String requireTextField(
      JsonNode section, String displayName, String fieldName, int maxLength) {
    if (!section.has(fieldName) || section.get(fieldName).isNull()) {
      throw validationError(displayName + "은 필수 항목입니다.");
    }
    return validateTextField(section.get(fieldName), displayName, maxLength);
  }

  private String optionalTextField(
      JsonNode section, String displayName, String fieldName, int maxLength) {
    if (!section.has(fieldName)) {
      return null;
    }
    if (section.get(fieldName).isNull()) {
      throw validationError(displayName + "은 null일 수 없습니다.");
    }
    return validateTextField(section.get(fieldName), displayName, maxLength);
  }

  private String validateTextField(JsonNode value, String displayName, int maxLength) {
    if (!value.isTextual()) {
      throw validationError(displayName + "은 문자열이어야 합니다.");
    }
    String trimmed = value.asText().trim();
    if (trimmed.isBlank()) {
      throw validationError(displayName + "은 빈 값일 수 없습니다.");
    }
    if (trimmed.length() > maxLength) {
      throw validationError(displayName + "은 " + maxLength + "자 이하여야 합니다.");
    }
    return trimmed;
  }

  private BadRequestException validationError(String message) {
    return new BadRequestException("VALIDATION_ERROR", message);
  }
}
