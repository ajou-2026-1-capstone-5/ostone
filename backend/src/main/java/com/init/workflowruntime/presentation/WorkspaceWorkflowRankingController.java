package com.init.workflowruntime.presentation;

import com.init.shared.presentation.AuthenticationUtils;
import com.init.workflowruntime.application.WorkspaceWorkflowRankingService;
import com.init.workflowruntime.application.command.GetWorkspaceWorkflowRankingsCommand;
import com.init.workflowruntime.application.dto.WorkspaceWorkflowRankingResponse;
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
@RequestMapping("/api/v1/workspaces/{workspaceId}/dashboard")
public class WorkspaceWorkflowRankingController {

  private final WorkspaceWorkflowRankingService workspaceWorkflowRankingService;

  public WorkspaceWorkflowRankingController(
      WorkspaceWorkflowRankingService workspaceWorkflowRankingService) {
    this.workspaceWorkflowRankingService = workspaceWorkflowRankingService;
  }

  @GetMapping("/workflow-rankings")
  public ResponseEntity<WorkspaceWorkflowRankingResponse> getWorkflowRankings(
      @PathVariable Long workspaceId,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(
        workspaceWorkflowRankingService.getRankings(
            new GetWorkspaceWorkflowRankingsCommand(workspaceId, userId, from, to)));
  }
}
