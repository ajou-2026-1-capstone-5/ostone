package com.init.chatdemo.presentation;

import com.init.chatdemo.application.DemoRuntimeMockService;
import com.init.chatdemo.presentation.dto.DemoChatSessionEndpointResponse;
import com.init.chatdemo.presentation.dto.DemoChatWorkflowResponse;
import com.init.chatdemo.presentation.dto.DemoDecisionLogEndpointResponse;
import com.init.chatdemo.presentation.dto.DemoDomainPackEndpointResponse;
import com.init.chatdemo.presentation.dto.DemoExecutionResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/demo")
public class DemoRuntimeController {

  private final DemoRuntimeMockService service;

  public DemoRuntimeController(DemoRuntimeMockService service) {
    this.service = service;
  }

  @GetMapping("/chat-workflow")
  public ResponseEntity<DemoChatWorkflowResponse> getChatWorkflow(@PathVariable Long workspaceId) {
    return ResponseEntity.ok(service.getChatWorkflow(workspaceId));
  }

  @GetMapping("/domain-pack")
  public ResponseEntity<DemoDomainPackEndpointResponse> getDomainPack(
      @PathVariable Long workspaceId) {
    return ResponseEntity.ok(service.getDomainPack(workspaceId));
  }

  @GetMapping("/chat-sessions/{sessionId}")
  public ResponseEntity<DemoChatSessionEndpointResponse> getChatSession(
      @PathVariable Long workspaceId, @PathVariable String sessionId) {
    return ResponseEntity.ok(service.getChatSession(workspaceId, sessionId));
  }

  @GetMapping("/workflow-executions/{executionId}")
  public ResponseEntity<DemoExecutionResponse> getWorkflowExecution(
      @PathVariable Long workspaceId, @PathVariable String executionId) {
    return ResponseEntity.ok(service.getWorkflowExecution(workspaceId, executionId));
  }

  @GetMapping("/decision-logs")
  public ResponseEntity<DemoDecisionLogEndpointResponse> getDecisionLogs(
      @PathVariable Long workspaceId, @RequestParam(required = true) String executionId) {
    return ResponseEntity.ok(service.getDecisionLogs(workspaceId, executionId));
  }
}
