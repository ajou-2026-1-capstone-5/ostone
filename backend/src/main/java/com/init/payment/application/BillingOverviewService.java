package com.init.payment.application;

import com.init.payment.application.exception.PlanNotFoundException;
import com.init.payment.domain.model.Plan;
import com.init.payment.domain.model.Subscription;
import com.init.payment.domain.model.SubscriptionStatus;
import com.init.payment.domain.repository.BillingKeyRepository;
import com.init.payment.domain.repository.PaymentRepository;
import com.init.payment.domain.repository.PlanRepository;
import com.init.payment.domain.repository.SubscriptionRepository;
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

  public BillingOverviewService(
      SubscriptionRepository subscriptionRepository,
      PlanRepository planRepository,
      BillingKeyRepository billingKeyRepository,
      PaymentRepository paymentRepository,
      WorkspaceQuotaUsagePort usagePort,
      PaymentAccessGuard accessGuard) {
    this.subscriptionRepository = subscriptionRepository;
    this.planRepository = planRepository;
    this.billingKeyRepository = billingKeyRepository;
    this.paymentRepository = paymentRepository;
    this.usagePort = usagePort;
    this.accessGuard = accessGuard;
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
            plan.getPipelineRunLimit()));
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
