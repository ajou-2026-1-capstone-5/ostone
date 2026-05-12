package com.init.domainpack.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class WorkflowTransitionOutcomeEmptyException extends BadRequestException {
  public WorkflowTransitionOutcomeEmptyException() {
    super("WORKFLOW_TRANSITION_OUTCOME_EMPTY", "outcome에는 state 또는 label 중 하나가 필요합니다.");
  }
}
