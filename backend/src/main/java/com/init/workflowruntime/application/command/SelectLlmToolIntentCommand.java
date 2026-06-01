package com.init.workflowruntime.application.command;

public record SelectLlmToolIntentCommand(
    Long sessionId, String intentCode, Long workflowDefinitionId) {

  public SelectLlmToolIntentCommand(Long sessionId, String intentCode) {
    this(sessionId, intentCode, null);
  }
}
