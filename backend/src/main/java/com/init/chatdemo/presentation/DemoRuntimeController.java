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
@RequestMapping("/api/v1/demo")
public class DemoRuntimeController {

  private final DemoRuntimeMockService service;

  public DemoRuntimeController(DemoRuntimeMockService service) {
    this.service = service;
  }

  @GetMapping("/chat-workflow")
  public ResponseEntity<DemoChatWorkflowResponse> getChatWorkflow() {
    return ResponseEntity.ok(service.getChatWorkflow());
  }

  @GetMapping("/domain-pack")
  public ResponseEntity<DemoDomainPackEndpointResponse> getDomainPack() {
    return ResponseEntity.ok(service.getDomainPack());
  }

  @GetMapping("/chat-sessions/{sessionId}")
  public ResponseEntity<DemoChatSessionEndpointResponse> getChatSession(
      @PathVariable String sessionId) {
    return ResponseEntity.ok(service.getChatSession(sessionId));
  }

  @GetMapping("/workflow-executions/{executionId}")
  public ResponseEntity<DemoExecutionResponse> getWorkflowExecution(
      @PathVariable String executionId) {
    return ResponseEntity.ok(service.getWorkflowExecution(executionId));
  }

  @GetMapping("/decision-logs")
  public ResponseEntity<DemoDecisionLogEndpointResponse> getDecisionLogs(
      @RequestParam(required = true) String executionId) {
    return ResponseEntity.ok(service.getDecisionLogs(executionId));
  }
}
