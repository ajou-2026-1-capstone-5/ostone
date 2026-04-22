package com.init.domainpack.application.exception;

import com.init.shared.application.exception.NotFoundException;

public class WorkflowTransitionNotFoundException extends NotFoundException {
  public WorkflowTransitionNotFoundException(String transitionId) {
    super("WORKFLOW_TRANSITION_NOT_FOUND", "Workflow transition not found: " + transitionId);
  }
}
