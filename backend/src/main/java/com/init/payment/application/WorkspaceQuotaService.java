package com.init.payment.application;

import com.init.shared.application.exception.QuotaExceededException;
import com.init.shared.application.quota.WorkspaceQuotaValidator;
import java.time.Clock;
import java.time.OffsetDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class WorkspaceQuotaService implements WorkspaceQuotaValidator {

  private final WorkspaceQuotaQueryPort quotaQueryPort;
  private final WorkspaceQuotaUsagePort usagePort;
  private final Clock clock;

  public WorkspaceQuotaService(
      WorkspaceQuotaQueryPort quotaQueryPort, WorkspaceQuotaUsagePort usagePort, Clock clock) {
    this.quotaQueryPort = quotaQueryPort;
    this.usagePort = usagePort;
    this.clock = clock;
  }

  @Override
  public void assertDatasetUploadAllowed(Long workspaceId) {
    OffsetDateTime now = OffsetDateTime.now(clock);
    quotaQueryPort
        .findCurrentQuota(workspaceId, now)
        .ifPresentOrElse(
            quota ->
                assertWithinLimit(
                    workspaceId,
                    QuotaResource.DATASET_UPLOAD,
                    quota.datasetUploadLimit(),
                    usagePort.countDatasetUploads(
                        workspaceId, quota.currentPeriodStart(), quota.currentPeriodEnd())),
            () ->
                assertFreeOnboardingAllowed(
                    workspaceId,
                    QuotaResource.DATASET_UPLOAD,
                    usagePort.countDatasetUploads(workspaceId)));
  }

  @Override
  public void assertPipelineRunAllowed(Long workspaceId) {
    OffsetDateTime now = OffsetDateTime.now(clock);
    quotaQueryPort
        .findCurrentQuota(workspaceId, now)
        .ifPresentOrElse(
            quota ->
                assertWithinLimit(
                    workspaceId,
                    QuotaResource.PIPELINE_RUN,
                    quota.pipelineRunLimit(),
                    usagePort.countPipelineRuns(
                        workspaceId, quota.currentPeriodStart(), quota.currentPeriodEnd())),
            () ->
                assertFreeOnboardingAllowed(
                    workspaceId,
                    QuotaResource.PIPELINE_RUN,
                    usagePort.countPipelineRuns(workspaceId)));
  }

  private void assertWithinLimit(Long workspaceId, QuotaResource resource, int limit, long used) {
    if (used < limit || canUseFreeOnboarding(workspaceId, used)) {
      return;
    }
    throw new QuotaExceededException(resource.code(), limit, used);
  }

  private void assertFreeOnboardingAllowed(Long workspaceId, QuotaResource resource, long used) {
    if (canUseFreeOnboarding(workspaceId, used)) {
      return;
    }
    throw new QuotaExceededException(resource.code(), 0, used);
  }

  private boolean canUseFreeOnboarding(Long workspaceId, long used) {
    return used == 0 && quotaQueryPort.hasFreeOnboardingAllowance(workspaceId);
  }
}
