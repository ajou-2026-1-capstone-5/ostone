package com.init.domainpack.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class WorkflowCycleDetectedException extends BadRequestException {
  public WorkflowCycleDetectedException(String workflowCode) {
    super("WORKFLOW_CYCLE_DETECTED", "workflow 그래프에 사이클이 있습니다. workflowCode=" + workflowCode);
  }
}
