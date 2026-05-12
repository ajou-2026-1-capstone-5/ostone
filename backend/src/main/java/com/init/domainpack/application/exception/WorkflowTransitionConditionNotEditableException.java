package com.init.domainpack.application.exception;

import com.init.shared.application.exception.BadRequestException;

@SuppressWarnings("java:S110")
public class WorkflowTransitionConditionNotEditableException extends BadRequestException {
  public WorkflowTransitionConditionNotEditableException(String transitionId) {
    super(
        "WORKFLOW_TRANSITION_CONDITION_NOT_EDITABLE",
        "DECISION 발신 transition에서만 condition을 수정할 수 있습니다: " + transitionId);
  }
}
