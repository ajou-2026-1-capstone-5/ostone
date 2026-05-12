package com.init.domainpack.application.exception;

import com.init.shared.application.exception.BadRequestException;

@SuppressWarnings("java:S110")
public class WorkflowTransitionPatchEmptyException extends BadRequestException {
  public WorkflowTransitionPatchEmptyException() {
    super("WORKFLOW_TRANSITION_PATCH_EMPTY", "수정할 transition 필드가 없습니다.");
  }
}
