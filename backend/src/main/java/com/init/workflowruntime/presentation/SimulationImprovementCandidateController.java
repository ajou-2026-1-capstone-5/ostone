package com.init.workflowruntime.presentation;

import com.init.shared.presentation.AuthenticationUtils;
import com.init.workflowruntime.application.SimulationImprovementCandidateService;
import com.init.workflowruntime.application.command.CreateSimulationImprovementCandidateCommand;
import com.init.workflowruntime.application.command.UpdateSimulationImprovementCandidateStatusCommand;
import com.init.workflowruntime.application.dto.SimulationImprovementCandidatePageResponse;
import com.init.workflowruntime.application.dto.SimulationImprovementCandidateResponse;
import com.init.workflowruntime.presentation.dto.CreateSimulationImprovementCandidateRequest;
import com.init.workflowruntime.presentation.dto.UpdateSimulationImprovementCandidateStatusRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/simulation/improvement-candidates")
public class SimulationImprovementCandidateController {

  private final SimulationImprovementCandidateService candidateService;

  public SimulationImprovementCandidateController(
      SimulationImprovementCandidateService candidateService) {
    this.candidateService = candidateService;
  }

  @PostMapping("/from-feedback/{feedbackId}")
  public ResponseEntity<SimulationImprovementCandidateResponse> createFromFeedback(
      @PathVariable Long workspaceId,
      @PathVariable Long feedbackId,
      @Valid @RequestBody(required = false) CreateSimulationImprovementCandidateRequest request,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    CreateSimulationImprovementCandidateRequest safeRequest =
        request != null
            ? request
            : new CreateSimulationImprovementCandidateRequest(null, null, null, null, null);
    return ResponseEntity.ok(
        candidateService.createFromFeedback(
            new CreateSimulationImprovementCandidateCommand(
                workspaceId,
                userId,
                feedbackId,
                safeRequest.targetElementType(),
                safeRequest.targetElementId(),
                safeRequest.targetElementKey(),
                safeRequest.beforeSummary(),
                safeRequest.afterSummary())));
  }

  @GetMapping
  public ResponseEntity<SimulationImprovementCandidatePageResponse> listCandidates(
      @PathVariable Long workspaceId,
      @RequestParam(required = false) String status,
      @RequestParam(defaultValue = "0") @Min(0) int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(
        candidateService.listCandidates(workspaceId, userId, status, page, size));
  }

  @GetMapping("/{candidateId}")
  public ResponseEntity<SimulationImprovementCandidateResponse> getCandidate(
      @PathVariable Long workspaceId,
      @PathVariable Long candidateId,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(candidateService.getCandidate(workspaceId, userId, candidateId));
  }

  @PatchMapping("/{candidateId}/status")
  public ResponseEntity<SimulationImprovementCandidateResponse> updateStatus(
      @PathVariable Long workspaceId,
      @PathVariable Long candidateId,
      @Valid @RequestBody UpdateSimulationImprovementCandidateStatusRequest request,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(
        candidateService.updateStatus(
            new UpdateSimulationImprovementCandidateStatusCommand(
                workspaceId, userId, candidateId, request.status())));
  }
}
