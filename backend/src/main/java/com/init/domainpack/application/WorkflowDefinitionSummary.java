package com.init.domainpack.application;

import com.init.domainpack.domain.repository.WorkflowDefinitionSummaryRow;
import java.time.OffsetDateTime;

public record WorkflowDefinitionSummary(
    Long id,
    String workflowCode,
    String name,
    String description,
    String initialState,
    String terminalStatesJson,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {

  public static WorkflowDefinitionSummary from(WorkflowDefinitionSummaryRow row) {
    return new WorkflowDefinitionSummary(
        row.getId(),
        row.getWorkflowCode(),
        row.getName(),
        row.getDescription(),
        row.getInitialState(),
        row.getTerminalStatesJson(),
        row.getCreatedAt(),
        row.getUpdatedAt());
  }
}
