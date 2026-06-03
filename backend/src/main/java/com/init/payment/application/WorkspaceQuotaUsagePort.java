package com.init.payment.application;

import java.time.OffsetDateTime;

public interface WorkspaceQuotaUsagePort {

  long countDatasetUploads(
      Long workspaceId, OffsetDateTime fromInclusive, OffsetDateTime toExclusive);

  long countPipelineRuns(
      Long workspaceId, OffsetDateTime fromInclusive, OffsetDateTime toExclusive);

  long countDatasetUploads(Long workspaceId);

  long countPipelineRuns(Long workspaceId);
}
