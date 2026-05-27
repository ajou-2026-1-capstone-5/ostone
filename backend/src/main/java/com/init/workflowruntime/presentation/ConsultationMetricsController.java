package com.init.workflowruntime.presentation;

import com.init.shared.presentation.AuthenticationUtils;
import com.init.workflowruntime.application.ConsultationMetricsService;
import com.init.workflowruntime.application.dto.ConsultationMetricsResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/consultation")
public class ConsultationMetricsController {

  private final ConsultationMetricsService consultationMetricsService;

  public ConsultationMetricsController(ConsultationMetricsService consultationMetricsService) {
    this.consultationMetricsService = consultationMetricsService;
  }

  @GetMapping("/metrics")
  public ResponseEntity<ConsultationMetricsResponse> getMetrics(
      @PathVariable Long workspaceId, Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(consultationMetricsService.getWorkspaceMetrics(workspaceId, userId));
  }
}
