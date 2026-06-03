package com.init.workflowruntime.presentation;

import com.init.shared.presentation.AuthenticationUtils;
import com.init.workflowruntime.application.ConsultationMetricsService;
import com.init.workflowruntime.application.command.GetWorkspaceMetricsCommand;
import com.init.workflowruntime.application.dto.ConsultationMetricsResponse;
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
@RequestMapping("/api/v1/workspaces/{workspaceId}/consultation")
public class ConsultationMetricsController {

  private final ConsultationMetricsService consultationMetricsService;

  public ConsultationMetricsController(ConsultationMetricsService consultationMetricsService) {
    this.consultationMetricsService = consultationMetricsService;
  }

  @GetMapping("/metrics")
  public ResponseEntity<ConsultationMetricsResponse> getMetrics(
      @PathVariable Long workspaceId,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(
        consultationMetricsService.getWorkspaceMetrics(
            new GetWorkspaceMetricsCommand(workspaceId, userId, from, to)));
  }
}
