package com.init.payment.application;

import java.time.OffsetDateTime;

public interface WorkspaceQuotaUsagePort {

  long countMembers(Long workspaceId);

  long countDatasetUploads(
      Long workspaceId, OffsetDateTime fromInclusive, OffsetDateTime toExclusive);

  long countPipelineRuns(
      Long workspaceId, OffsetDateTime fromInclusive, OffsetDateTime toExclusive);

  long countDatasetUploads(Long workspaceId);

  long countPipelineRuns(Long workspaceId);
}
