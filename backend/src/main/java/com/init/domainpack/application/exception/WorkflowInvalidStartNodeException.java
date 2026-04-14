package com.init.domainpack.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class WorkflowInvalidStartNodeException extends BadRequestException {
  public WorkflowInvalidStartNodeException(String workflowCode) {
    super("WORKFLOW_INVALID_START_NODE", "START 노드가 정확히 1개여야 합니다. workflowCode=" + workflowCode);
  }
}
