package com.init.domainpack.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class WorkflowDanglingEdgeException extends BadRequestException {
  public WorkflowDanglingEdgeException(String workflowCode) {
    super("WORKFLOW_DANGLING_EDGE", "엣지가 존재하지 않는 노드를 참조합니다. workflowCode=" + workflowCode);
  }
}
