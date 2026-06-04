package com.init.workflowruntime.presentation;

import com.init.shared.presentation.AuthenticationUtils;
import com.init.workflowruntime.application.SimulationService;
import com.init.workflowruntime.application.dto.SimulationFeedbackPageResponse;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/simulation/feedback")
public class SimulationFeedbackController {

  private final SimulationService simulationService;

  public SimulationFeedbackController(SimulationService simulationService) {
    this.simulationService = simulationService;
  }

  @GetMapping
  public ResponseEntity<SimulationFeedbackPageResponse> listFeedback(
      @PathVariable Long workspaceId,
      @RequestParam(required = false) String status,
      @RequestParam(defaultValue = "0") @Min(0) int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(
        simulationService.listFeedback(workspaceId, userId, status, page, size));
  }
}
