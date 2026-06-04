package com.init.workflowruntime.domain;

import java.time.OffsetDateTime;
import java.util.List;

public interface WorkflowRankingRepository {

  long countOperationalConsultations(
      Long workspaceId, OffsetDateTime periodStart, OffsetDateTime periodEnd);

  List<WorkflowRankingExecutionRow> findExecutionRows(
      Long workspaceId, OffsetDateTime periodStart, OffsetDateTime periodEnd);
}
