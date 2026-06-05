package com.init.workflowruntime.presentation;

import com.init.shared.presentation.AuthenticationUtils;
import com.init.workflowruntime.application.SimulationGoldenCaseService;
import com.init.workflowruntime.application.command.CreateSimulationGoldenCaseCommand;
import com.init.workflowruntime.application.command.ReplaySimulationGoldenCaseCommand;
import com.init.workflowruntime.application.dto.SimulationGoldenCasePageResponse;
import com.init.workflowruntime.application.dto.SimulationGoldenCaseReplayResultPageResponse;
import com.init.workflowruntime.application.dto.SimulationGoldenCaseReplayResultResponse;
import com.init.workflowruntime.application.dto.SimulationGoldenCaseResponse;
import com.init.workflowruntime.presentation.dto.CreateSimulationGoldenCaseRequest;
import com.init.workflowruntime.presentation.dto.ReplaySimulationGoldenCaseRequest;
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
@RequestMapping("/api/v1/workspaces/{workspaceId}/simulation")
public class SimulationGoldenCaseController {

  private final SimulationGoldenCaseService goldenCaseService;

  public SimulationGoldenCaseController(SimulationGoldenCaseService goldenCaseService) {
    this.goldenCaseService = goldenCaseService;
  }

  @PostMapping("/sessions/{sessionId}/golden-cases")
  public ResponseEntity<SimulationGoldenCaseResponse> createGoldenCase(
      @PathVariable Long workspaceId,
      @PathVariable Long sessionId,
      @Valid @RequestBody(required = false) CreateSimulationGoldenCaseRequest request,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    CreateSimulationGoldenCaseRequest safeRequest =
        request != null
            ? request
            : new CreateSimulationGoldenCaseRequest(null, null, null, null, null, null);
    return ResponseEntity.ok(
        goldenCaseService.createFromSession(
            new CreateSimulationGoldenCaseCommand(
                workspaceId,
                sessionId,
                userId,
                safeRequest.name(),
                safeRequest.expectedIntentCode(),
                safeRequest.expectedWorkflowCode(),
                safeRequest.expectedCurrentState(),
                safeRequest.expectedActionType(),
                safeRequest.expectedSlotValues())));
  }

  @GetMapping("/golden-cases")
  public ResponseEntity<SimulationGoldenCasePageResponse> listGoldenCases(
      @PathVariable Long workspaceId,
      @RequestParam(defaultValue = "0") @Min(0) int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(goldenCaseService.listGoldenCases(workspaceId, userId, page, size));
  }

  @PostMapping("/golden-cases/{goldenCaseId}/replays")
  public ResponseEntity<SimulationGoldenCaseReplayResultResponse> replayGoldenCase(
      @PathVariable Long workspaceId,
      @PathVariable Long goldenCaseId,
      @Valid @RequestBody ReplaySimulationGoldenCaseRequest request,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(
        goldenCaseService.replay(
            new ReplaySimulationGoldenCaseCommand(
                workspaceId, goldenCaseId, request.domainPackVersionId(), userId)));
  }

  @GetMapping("/golden-cases/{goldenCaseId}/replays")
  public ResponseEntity<SimulationGoldenCaseReplayResultPageResponse> listReplayResults(
      @PathVariable Long workspaceId,
      @PathVariable Long goldenCaseId,
      @RequestParam(defaultValue = "0") @Min(0) int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(
        goldenCaseService.listReplayResults(workspaceId, userId, goldenCaseId, page, size));
  }
}
