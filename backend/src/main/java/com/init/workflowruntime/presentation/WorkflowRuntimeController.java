package com.init.workflowruntime.presentation;

import com.init.workflowruntime.application.WorkflowRuntimeService;
import com.init.workflowruntime.application.dto.WorkflowAdvanceResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workflow-runtime/sessions/{sessionId}")
public class WorkflowRuntimeController {

  private final WorkflowRuntimeService workflowRuntimeService;

  public WorkflowRuntimeController(WorkflowRuntimeService workflowRuntimeService) {
    this.workflowRuntimeService = workflowRuntimeService;
  }

  @PostMapping("/advance")
  public ResponseEntity<WorkflowAdvanceResponse> advance(@PathVariable Long sessionId) {
    return ResponseEntity.ok(workflowRuntimeService.advance(sessionId));
  }
}
