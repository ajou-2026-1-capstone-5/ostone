package com.init.workspace.presentation;

import com.init.shared.presentation.AuthenticationUtils;
import com.init.workspace.application.GetWorkspaceDashboardActionRecommendationsCommand;
import com.init.workspace.application.GetWorkspaceDashboardActionRecommendationsUseCase;
import com.init.workspace.application.GetWorkspaceDashboardHealthUseCase;
import com.init.workspace.application.WorkspaceDashboardActionRecommendationsResult;
import com.init.workspace.application.WorkspaceDashboardHealthResult;
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
public class WorkspaceDashboardController {

  private final GetWorkspaceDashboardHealthUseCase getWorkspaceDashboardHealthUseCase;
  private final GetWorkspaceDashboardActionRecommendationsUseCase
      getWorkspaceDashboardActionRecommendationsUseCase;

  public WorkspaceDashboardController(
      GetWorkspaceDashboardHealthUseCase getWorkspaceDashboardHealthUseCase,
      GetWorkspaceDashboardActionRecommendationsUseCase
          getWorkspaceDashboardActionRecommendationsUseCase) {
    this.getWorkspaceDashboardHealthUseCase = getWorkspaceDashboardHealthUseCase;
    this.getWorkspaceDashboardActionRecommendationsUseCase =
        getWorkspaceDashboardActionRecommendationsUseCase;
  }

  @GetMapping("/knowledge-pack-health")
  public ResponseEntity<WorkspaceDashboardHealthResult> getKnowledgePackHealth(
      @PathVariable Long workspaceId, Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(getWorkspaceDashboardHealthUseCase.execute(workspaceId, userId));
  }

  @GetMapping("/action-recommendations")
  public ResponseEntity<WorkspaceDashboardActionRecommendationsResult> getActionRecommendations(
      @PathVariable Long workspaceId,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(
        getWorkspaceDashboardActionRecommendationsUseCase.execute(
            new GetWorkspaceDashboardActionRecommendationsCommand(workspaceId, userId, from, to)));
  }
}
