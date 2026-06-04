package com.init.workspace.application;

public interface WorkspaceDashboardQueryPort {

  WorkspaceDashboardHealthResult findKnowledgePackHealth(Long workspaceId);

  WorkspaceDashboardRecommendationSignalsResult findRecommendationSignals(
      Long workspaceId,
      java.time.OffsetDateTime periodStart,
      java.time.OffsetDateTime periodEnd,
      java.time.OffsetDateTime previousPeriodStart);
}
