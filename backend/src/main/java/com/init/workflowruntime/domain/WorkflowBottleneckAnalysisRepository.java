package com.init.workflowruntime.domain;

import java.time.OffsetDateTime;
import java.util.List;

public interface WorkflowBottleneckAnalysisRepository {

  List<WorkflowBottleneckExecutionRow> findExecutionRows(
      Long workspaceId,
      Long workflowDefinitionId,
      OffsetDateTime periodStart,
      OffsetDateTime periodEnd);

  List<WorkflowBottleneckStepRow> findStepRows(
      Long workspaceId,
      Long workflowDefinitionId,
      OffsetDateTime periodStart,
      OffsetDateTime periodEnd);

  List<WorkflowBottleneckDecisionRow> findDecisionRows(
      Long workspaceId,
      Long workflowDefinitionId,
      OffsetDateTime periodStart,
      OffsetDateTime periodEnd);
}
