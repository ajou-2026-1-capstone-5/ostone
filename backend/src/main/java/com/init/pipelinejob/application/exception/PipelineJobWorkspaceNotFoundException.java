package com.init.pipelinejob.application.exception;

import com.init.shared.application.exception.NotFoundException;

// @SuppressWarnings("java:S110") — false positive: BC 경계 분리를 위한 의도적인 계층 구조
// (INFO-002 per audit-report-inspection-backend-2026-05-08-1449, user-approved)
@SuppressWarnings("java:S110")
public class PipelineJobWorkspaceNotFoundException extends NotFoundException {

  public PipelineJobWorkspaceNotFoundException(String message) {
    super("WORKSPACE_NOT_FOUND", message);
  }
}
