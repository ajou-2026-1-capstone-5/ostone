package com.init.domainpack.application.exception;

import com.init.shared.application.exception.NotFoundException;

public class WorkflowDefinitionNotFoundException extends NotFoundException {
  public WorkflowDefinitionNotFoundException(Long workflowId) {
    super("WORKFLOW_DEFINITION_NOT_FOUND", "WorkflowDefinition not found: " + workflowId);
  }
}
