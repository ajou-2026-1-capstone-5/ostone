package com.init.workflowruntime.presentation;

import com.init.shared.presentation.AuthenticationUtils;
import com.init.workflowruntime.application.SimulationService;
import com.init.workflowruntime.application.command.CreateSimulationFeedbackCommand;
import com.init.workflowruntime.application.command.CreateSimulationSessionCommand;
import com.init.workflowruntime.application.command.SendSimulationMessageCommand;
import com.init.workflowruntime.application.dto.SimulationSessionDetailResponse;
import com.init.workflowruntime.application.dto.SimulationSessionPageResponse;
import com.init.workflowruntime.domain.SimulationFeedbackSeverity;
import com.init.workflowruntime.domain.SimulationFeedbackType;
import com.init.workflowruntime.presentation.dto.CreateSimulationFeedbackRequest;
import com.init.workflowruntime.presentation.dto.CreateSimulationSessionRequest;
import com.init.workflowruntime.presentation.dto.SendSimulationMessageRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/simulation/sessions")
public class SimulationController {

  private final SimulationService simulationService;

  public SimulationController(SimulationService simulationService) {
    this.simulationService = simulationService;
  }

  @PostMapping
  public ResponseEntity<SimulationSessionDetailResponse> createSession(
      @PathVariable Long workspaceId,
      @Valid @RequestBody CreateSimulationSessionRequest request,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(
        simulationService.createSession(
            new CreateSimulationSessionCommand(
                workspaceId,
                userId,
                request.customerName(),
                request.intentCode(),
                request.workflowDefinitionId())));
  }

  @GetMapping
  public ResponseEntity<SimulationSessionPageResponse> listSessions(
      @PathVariable Long workspaceId,
      @RequestParam(defaultValue = "0") @Min(0) int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(simulationService.listSessions(workspaceId, userId, page, size));
  }

  @GetMapping("/{sessionId}")
  public ResponseEntity<SimulationSessionDetailResponse> getSession(
      @PathVariable Long workspaceId, @PathVariable Long sessionId, Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(simulationService.getSession(workspaceId, sessionId, userId));
  }

  @PostMapping("/{sessionId}/messages")
  public ResponseEntity<SimulationSessionDetailResponse> sendMessage(
      @PathVariable Long workspaceId,
      @PathVariable Long sessionId,
      @Valid @RequestBody SendSimulationMessageRequest request,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(
        simulationService.sendMessage(
            new SendSimulationMessageCommand(workspaceId, sessionId, userId, request.content())));
  }

  @PostMapping("/{sessionId}/feedback")
  public ResponseEntity<SimulationSessionDetailResponse> createFeedback(
      @PathVariable Long workspaceId,
      @PathVariable Long sessionId,
      @Valid @RequestBody CreateSimulationFeedbackRequest request,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(
        simulationService.createFeedback(
            new CreateSimulationFeedbackCommand(
                workspaceId,
                sessionId,
                userId,
                request.chatMessageId(),
                SimulationFeedbackType.valueOf(request.feedbackType().name()),
                request.description(),
                request.expectedBehavior(),
                SimulationFeedbackSeverity.valueOf(request.severity().name()))));
  }
}
