package com.init.workflowruntime.application.command;

public record StartAssistantWorkflowCommand(
    Long sessionId, String intentCode, String workflowCode) {

  public StartAssistantWorkflowCommand(Long sessionId, String intentCode) {
    this(sessionId, intentCode, null);
  }
}
