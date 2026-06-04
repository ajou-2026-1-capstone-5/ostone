package com.init.workflowruntime.application.command;

import java.time.LocalDate;

public record GetWorkflowBottleneckAnalysisCommand(
    Long workspaceId,
    Long userId,
    Long workflowDefinitionId,
    LocalDate fromDate,
    LocalDate toDate) {

  public GetWorkflowBottleneckAnalysisCommand(
      Long workspaceId, Long userId, Long workflowDefinitionId) {
    this(workspaceId, userId, workflowDefinitionId, null, null);
  }
}
