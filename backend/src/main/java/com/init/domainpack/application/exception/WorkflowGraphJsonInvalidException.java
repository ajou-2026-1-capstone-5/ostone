package com.init.domainpack.application.exception;

import com.init.shared.application.exception.InternalException;

public class WorkflowGraphJsonInvalidException extends InternalException {
  private static final String DEFAULT_MESSAGE = "graphJson이 유효하지 않은 JSON입니다.";

  public WorkflowGraphJsonInvalidException() {
    super("WORKFLOW_GRAPH_JSON_INVALID", DEFAULT_MESSAGE);
  }

  public WorkflowGraphJsonInvalidException(Throwable cause) {
    this();
    initCause(cause);
  }

  public WorkflowGraphJsonInvalidException(Long workflowId, Throwable cause) {
    super("WORKFLOW_GRAPH_JSON_INVALID", DEFAULT_MESSAGE + " workflowId=" + workflowId);
    initCause(cause);
  }
}
