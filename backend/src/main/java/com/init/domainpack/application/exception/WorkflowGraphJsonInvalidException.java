package com.init.domainpack.application.exception;

import com.init.shared.application.exception.InternalException;

public class WorkflowGraphJsonInvalidException extends InternalException {
  public WorkflowGraphJsonInvalidException() {
    super("WORKFLOW_GRAPH_JSON_INVALID", "graphJson이 유효하지 않은 JSON입니다.");
  }
}
