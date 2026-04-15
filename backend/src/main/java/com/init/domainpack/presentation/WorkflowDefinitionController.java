package com.init.domainpack.presentation;

import com.init.domainpack.application.GetWorkflowDefinitionListQuery;
import com.init.domainpack.application.GetWorkflowDefinitionListUseCase;
import com.init.domainpack.application.GetWorkflowDefinitionQuery;
import com.init.domainpack.application.GetWorkflowDefinitionUseCase;
import com.init.domainpack.application.WorkflowDefinitionDetail;
import com.init.domainpack.application.WorkflowDefinitionSummary;
import com.init.shared.presentation.AuthenticationUtils;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(
    "/api/v1/workspaces/{workspaceId}/domain-packs/{packId}/versions/{versionId}/workflows")
public class WorkflowDefinitionController {

  private final GetWorkflowDefinitionListUseCase listUseCase;
  private final GetWorkflowDefinitionUseCase detailUseCase;

  public WorkflowDefinitionController(
      GetWorkflowDefinitionListUseCase listUseCase, GetWorkflowDefinitionUseCase detailUseCase) {
    this.listUseCase = listUseCase;
    this.detailUseCase = detailUseCase;
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
}
