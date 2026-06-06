package com.init.payment.application;

import com.init.payment.application.exception.PlanNotFoundException;
import com.init.payment.domain.model.Plan;
import com.init.payment.domain.model.Subscription;
import com.init.payment.domain.model.SubscriptionStatus;
import com.init.payment.domain.repository.BillingKeyRepository;
import com.init.payment.domain.repository.PaymentRepository;
import com.init.payment.domain.repository.PlanRepository;
import com.init.payment.domain.repository.SubscriptionRepository;
import com.init.shared.application.quota.QuotaWindow;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class BillingOverviewService {

  private final SubscriptionRepository subscriptionRepository;
  private final PlanRepository planRepository;
  private final BillingKeyRepository billingKeyRepository;
  private final PaymentRepository paymentRepository;
  private final WorkspaceQuotaUsagePort usagePort;
  private final PaymentAccessGuard accessGuard;
  private final Clock clock;

  public BillingOverviewService(
      SubscriptionRepository subscriptionRepository,
      PlanRepository planRepository,
      BillingKeyRepository billingKeyRepository,
      PaymentRepository paymentRepository,
      WorkspaceQuotaUsagePort usagePort,
      PaymentAccessGuard accessGuard,
      Clock clock) {
    this.subscriptionRepository = subscriptionRepository;
    this.planRepository = planRepository;
    this.billingKeyRepository = billingKeyRepository;
    this.paymentRepository = paymentRepository;
    this.usagePort = usagePort;
    this.accessGuard = accessGuard;
    this.clock = clock;
  }

  public BillingOverviewResult getOverview(Long workspaceId, Long userId) {
    accessGuard.requireBillingManager(workspaceId, userId);

    return subscriptionRepository
        .findCurrentByWorkspaceId(workspaceId)
        .map(this::buildOverview)
        .orElseGet(BillingOverviewResult::empty);
  }

  private BillingOverviewResult buildOverview(Subscription subscription) {
    Plan plan = requirePlan(subscription.getPlanId());
    BillingKeySummary billingKey =
        billingKeyRepository
            .findActiveByWorkspaceId(subscription.getWorkspaceId())
            .map(BillingKeySummary::from)
            .orElse(null);
    List<PaymentResult> payments =
        paymentRepository
            .findByWorkspaceIdOrderByCreatedAtDesc(subscription.getWorkspaceId())
            .stream()
            .map(PaymentResult::from)
            .toList();

    return new BillingOverviewResult(
        SubscriptionResult.from(subscription, plan),
        billingKey,
        payments,
        quotaUsages(subscription, plan));
  }

  private List<QuotaUsageResult> quotaUsages(Subscription subscription, Plan plan) {
    if (!hasCurrentPeriod(subscription)) {
      return List.of();
    }

    Long workspaceId = subscription.getWorkspaceId();
    return List.of(
        QuotaUsageResult.of("MEMBER", usagePort.countMembers(workspaceId), plan.getMemberLimit()),
        QuotaUsageResult.of(
            "DATASET_UPLOAD",
            usagePort.countDatasetUploads(
                workspaceId,
                subscription.getCurrentPeriodStart(),
                subscription.getCurrentPeriodEnd()),
            plan.getDatasetUploadLimit()),
        QuotaUsageResult.of(
            "PIPELINE_RUN",
            usagePort.countPipelineRuns(
                workspaceId,
                subscription.getCurrentPeriodStart(),
                subscription.getCurrentPeriodEnd()),
            plan.getPipelineRunLimit()),
        domainPackOperationQuota(workspaceId, plan.getPipelineRunHourlyLimit()));
  }

  private QuotaUsageResult domainPackOperationQuota(Long workspaceId, int limit) {
    OffsetDateTime now = OffsetDateTime.now(clock);
    QuotaWindow window = QuotaWindow.hourEndingAt(now);
    long used =
        usagePort.countDomainPackOperations(
            workspaceId, window.fromInclusive(), window.toExclusive());
    OffsetDateTime nextAvailableAt =
        limit >= 0 && used >= limit
            ? usagePort
                .findOldestDomainPackOperationAt(
                    workspaceId, window.fromInclusive(), window.toExclusive())
                .map(oldest -> oldest.plusHours(1))
                .orElse(null)
            : null;
    return QuotaUsageResult.of("DOMAIN_PACK_OPERATION", used, limit, nextAvailableAt);
  }

  private boolean hasCurrentPeriod(Subscription subscription) {
    return (subscription.getStatus() == SubscriptionStatus.ACTIVE
            || subscription.getStatus() == SubscriptionStatus.PAST_DUE)
        && subscription.getCurrentPeriodStart() != null
        && subscription.getCurrentPeriodEnd() != null;
  }

  private Plan requirePlan(Long planId) {
    return planRepository
        .findById(planId)
        .orElseThrow(() -> new PlanNotFoundException("id=" + planId));
  }
}
