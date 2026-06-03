package com.init.workspace.presentation;

import com.init.shared.presentation.AuthenticationUtils;
import com.init.workspace.application.GetWorkspaceDashboardHealthUseCase;
import com.init.workspace.application.WorkspaceDashboardHealthResult;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/dashboard")
public class WorkspaceDashboardController {

  private final GetWorkspaceDashboardHealthUseCase getWorkspaceDashboardHealthUseCase;

  public WorkspaceDashboardController(
      GetWorkspaceDashboardHealthUseCase getWorkspaceDashboardHealthUseCase) {
    this.getWorkspaceDashboardHealthUseCase = getWorkspaceDashboardHealthUseCase;
  }

  @GetMapping("/knowledge-pack-health")
  public ResponseEntity<WorkspaceDashboardHealthResult> getKnowledgePackHealth(
      @PathVariable Long workspaceId, Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(getWorkspaceDashboardHealthUseCase.execute(workspaceId, userId));
  }
}
