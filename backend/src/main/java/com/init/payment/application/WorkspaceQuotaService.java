package com.init.payment.application;

import com.init.shared.application.exception.QuotaExceededException;
import com.init.shared.application.quota.QuotaWindow;
import com.init.shared.application.quota.WorkspaceQuotaValidator;
import java.time.Clock;
import java.time.OffsetDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class WorkspaceQuotaService implements WorkspaceQuotaValidator {

  /** 미구독(Free) 워크스페이스의 멤버 한도 — 오너 1명만 허용. */
  private static final int FREE_MEMBER_LIMIT = 1;

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

  /**
   * 도메인팩 생성·검토 시간당 한도 강제. 구독 시 plan의 {@code pipelineRunHourlyLimit}(롤링 1시간 윈도우)로, 미구독 시
   * free-onboarding 1회로 제한한다. {@code limit < 0}은 무제한(Enterprise)이다.
   */
  @Override
  public void assertPipelineRunAllowed(Long workspaceId) {
    OffsetDateTime now = OffsetDateTime.now(clock);
    QuotaWindow window = QuotaWindow.hourEndingAt(now);
    quotaQueryPort
        .findCurrentQuota(workspaceId, now)
        .ifPresentOrElse(
            quota -> {
              if (isUnlimited(quota.pipelineRunHourlyLimit())) {
                return;
              }
              assertWithinLimit(
                  workspaceId,
                  QuotaResource.DOMAIN_PACK_OPERATION,
                  quota.pipelineRunHourlyLimit(),
                  usagePort.countDomainPackOperations(
                      workspaceId, window.fromInclusive(), window.toExclusive()));
            },
            () ->
                assertFreeOnboardingAllowed(
                    workspaceId,
                    QuotaResource.DOMAIN_PACK_OPERATION,
                    usagePort.countDomainPackOperations(workspaceId)));
  }

  /**
   * 멤버 추가 한도 강제. 구독 시 plan의 {@code memberLimit}, 미구독(Free) 시 {@link #FREE_MEMBER_LIMIT}로 제한한다. 멤버
   * 저장 직전 호출되므로 신규 워크스페이스의 오너 생성(used=0)은 항상 통과한다.
   */
  @Override
  public void assertMemberAddAllowed(Long workspaceId) {
    int limit =
        quotaQueryPort
            .findCurrentQuota(workspaceId, OffsetDateTime.now(clock))
            .map(WorkspaceQuota::memberLimit)
            .orElse(FREE_MEMBER_LIMIT);
    if (isUnlimited(limit)) {
      return;
    }
    long used = usagePort.countMembers(workspaceId);
    if (used < limit) {
      return;
    }
    throw new QuotaExceededException(QuotaResource.MEMBER.code(), limit, used);
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

  private boolean isUnlimited(int limit) {
    return limit < 0;
  }
}
