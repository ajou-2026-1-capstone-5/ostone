package com.init.payment.application;

import java.time.OffsetDateTime;

public interface WorkspaceQuotaUsagePort {

  long countMembers(Long workspaceId);

  long countDatasetUploads(
      Long workspaceId, OffsetDateTime fromInclusive, OffsetDateTime toExclusive);

  long countPipelineRuns(
      Long workspaceId, OffsetDateTime fromInclusive, OffsetDateTime toExclusive);

  /** 윈도우 내 도메인팩 생성(pipeline_job) + 검토(review_decision) 합산 — 시간당 한도 강제용. */
  long countDomainPackOperations(
      Long workspaceId, OffsetDateTime fromInclusive, OffsetDateTime toExclusive);

  long countDatasetUploads(Long workspaceId);

  long countPipelineRuns(Long workspaceId);

  /** 윈도우 미지정 — free-onboarding 분기에서 누적 도메인팩 작업 수 확인용. */
  long countDomainPackOperations(Long workspaceId);
}
