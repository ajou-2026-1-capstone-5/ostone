package com.init.domainpack.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class WorkflowEdgeIdDuplicateException extends BadRequestException {
  public WorkflowEdgeIdDuplicateException(String workflowCode) {
    super("WORKFLOW_EDGE_ID_DUPLICATE", "edge id가 중복되었습니다. workflowCode=" + workflowCode);
  }
}
