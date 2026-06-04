package com.init.workflowruntime.presentation;

import com.init.shared.presentation.AuthenticationUtils;
import com.init.workflowruntime.application.WorkspaceWorkflowBottleneckAnalysisService;
import com.init.workflowruntime.application.command.GetWorkflowBottleneckAnalysisCommand;
import com.init.workflowruntime.application.dto.WorkspaceWorkflowBottleneckAnalysisResponse;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/dashboard/workflows")
public class WorkspaceWorkflowBottleneckAnalysisController {

  private final WorkspaceWorkflowBottleneckAnalysisService analysisService;

  public WorkspaceWorkflowBottleneckAnalysisController(
      WorkspaceWorkflowBottleneckAnalysisService analysisService) {
    this.analysisService = analysisService;
  }

  @GetMapping("/{workflowDefinitionId}/bottleneck-analysis")
  public ResponseEntity<WorkspaceWorkflowBottleneckAnalysisResponse> getBottleneckAnalysis(
      @PathVariable Long workspaceId,
      @PathVariable Long workflowDefinitionId,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(
        analysisService.getAnalysis(
            new GetWorkflowBottleneckAnalysisCommand(
                workspaceId, userId, workflowDefinitionId, from, to)));
  }
}
