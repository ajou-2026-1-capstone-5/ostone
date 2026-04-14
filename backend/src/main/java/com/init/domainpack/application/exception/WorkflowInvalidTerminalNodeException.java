package com.init.domainpack.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class WorkflowInvalidTerminalNodeException extends BadRequestException {
  public WorkflowInvalidTerminalNodeException(String workflowCode) {
    super(
        "WORKFLOW_INVALID_TERMINAL_NODE",
        "TERMINAL 노드가 1개 이상이어야 합니다. workflowCode=" + workflowCode);
  }
}
