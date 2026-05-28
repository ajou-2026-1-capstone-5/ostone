package com.init.workflowruntime.domain;

import java.time.OffsetDateTime;
import java.util.List;

public interface ConsultationMetricsRepository {

  List<ConsultationMetricsSessionFact> findSessionFacts(
      Long workspaceId, OffsetDateTime periodStart, OffsetDateTime periodEnd);
}
