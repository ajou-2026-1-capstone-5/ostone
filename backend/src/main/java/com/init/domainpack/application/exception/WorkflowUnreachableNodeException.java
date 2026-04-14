package com.init.domainpack.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class WorkflowUnreachableNodeException extends BadRequestException {
  public WorkflowUnreachableNodeException(String workflowCode) {
    super("WORKFLOW_UNREACHABLE_NODE", "도달 불가 노드가 존재합니다. workflowCode=" + workflowCode);
  }
}
