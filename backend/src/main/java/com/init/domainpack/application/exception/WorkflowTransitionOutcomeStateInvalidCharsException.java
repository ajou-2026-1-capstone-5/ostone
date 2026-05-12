package com.init.domainpack.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class WorkflowTransitionOutcomeStateInvalidCharsException extends BadRequestException {
  public WorkflowTransitionOutcomeStateInvalidCharsException(String state) {
    super(
        "WORKFLOW_TRANSITION_OUTCOME_STATE_INVALID_CHARS",
        "outcome.state는 영문, 숫자, _, -만 사용할 수 있습니다: " + state);
  }
}
