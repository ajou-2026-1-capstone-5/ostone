package com.init.domainpack.application.exception;

import com.init.shared.application.exception.NotFoundException;

public class WorkflowTransitionNotFoundException extends NotFoundException {
  public WorkflowTransitionNotFoundException(String transitionId) {
    super("WORKFLOW_TRANSITION_NOT_FOUND", "워크플로우 전환을 찾을 수 없습니다: " + transitionId);
  }
}
