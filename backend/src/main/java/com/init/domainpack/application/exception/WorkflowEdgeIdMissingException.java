package com.init.domainpack.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class WorkflowEdgeIdMissingException extends BadRequestException {
  public WorkflowEdgeIdMissingException(String workflowCode) {
    super("WORKFLOW_EDGE_ID_MISSING", "모든 edge에 id 필드가 필요합니다. workflowCode=" + workflowCode);
  }
}
