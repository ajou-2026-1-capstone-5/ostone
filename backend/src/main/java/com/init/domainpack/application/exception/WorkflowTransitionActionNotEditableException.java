package com.init.domainpack.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class WorkflowTransitionActionNotEditableException extends BadRequestException {
  public WorkflowTransitionActionNotEditableException(String transitionId) {
    super(
        "WORKFLOW_TRANSITION_ACTION_NOT_EDITABLE",
        "ACTION 목적지 transition에서만 action을 수정할 수 있습니다: " + transitionId);
  }
}
