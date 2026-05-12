package com.init.domainpack.application.exception;

import com.init.shared.application.exception.BadRequestException;

@SuppressWarnings("java:S110")
public class WorkflowTransitionOutcomeNotEditableException extends BadRequestException {
  public WorkflowTransitionOutcomeNotEditableException(String transitionId) {
    super(
        "WORKFLOW_TRANSITION_OUTCOME_NOT_EDITABLE",
        "TERMINAL 목적지 transition에서만 outcome을 수정할 수 있습니다: " + transitionId);
  }
}
