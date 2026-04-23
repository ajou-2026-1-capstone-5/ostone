package com.init.domainpack.presentation;

import com.init.domainpack.application.GetWorkflowDefinitionListQuery;
import com.init.domainpack.application.GetWorkflowDefinitionListUseCase;
import com.init.domainpack.application.GetWorkflowDefinitionQuery;
import com.init.domainpack.application.GetWorkflowDefinitionUseCase;
import com.init.domainpack.application.GetWorkflowTransitionListQuery;
import com.init.domainpack.application.GetWorkflowTransitionListUseCase;
import com.init.domainpack.application.GetWorkflowTransitionQuery;
import com.init.domainpack.application.GetWorkflowTransitionUseCase;
import com.init.domainpack.application.UpdateWorkflowCommand;
import com.init.domainpack.application.UpdateWorkflowUseCase;
import com.init.domainpack.application.WorkflowDefinitionDetail;
import com.init.domainpack.application.WorkflowDefinitionSummary;
import com.init.domainpack.application.WorkflowTransitionDetail;
import com.init.domainpack.presentation.dto.UpdateWorkflowRequest;
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

  public WorkflowDefinitionController(
      GetWorkflowDefinitionListUseCase listUseCase,
      GetWorkflowDefinitionUseCase detailUseCase,
      UpdateWorkflowUseCase updateUseCase,
      GetWorkflowTransitionUseCase transitionUseCase,
      GetWorkflowTransitionListUseCase transitionListUseCase) {
    this.listUseCase = listUseCase;
    this.detailUseCase = detailUseCase;
    this.updateUseCase = updateUseCase;
    this.transitionUseCase = transitionUseCase;
    this.transitionListUseCase = transitionListUseCase;
  }

  @GetMapping
  public ResponseEntity<List<WorkflowDefinitionSummary>> listWorkflows(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @PathVariable Long versionId,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    List<WorkflowDefinitionSummary> result =
        listUseCase.execute(
            new GetWorkflowDefinitionListQuery(workspaceId, packId, versionId, userId));
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
}
