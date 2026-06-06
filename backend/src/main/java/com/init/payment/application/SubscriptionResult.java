package com.init.payment.application;

import com.init.payment.domain.model.Plan;
import com.init.payment.domain.model.Subscription;
import java.time.OffsetDateTime;
import java.util.List;

public record SubscriptionResult(
    Long id,
    Long workspaceId,
    String planKey,
    String status,
    OffsetDateTime currentPeriodStart,
    OffsetDateTime currentPeriodEnd,
    boolean cancelAtPeriodEnd,
    String customerKey,
    int memberLimit,
    int datasetUploadLimit,
    int pipelineRunLimit,
    List<QuotaUsageResult> quotaUsages) {

  public SubscriptionResult(
      Long id,
      Long workspaceId,
      String planKey,
      String status,
      OffsetDateTime currentPeriodStart,
      OffsetDateTime currentPeriodEnd,
      boolean cancelAtPeriodEnd,
      String customerKey,
      int memberLimit,
      int datasetUploadLimit,
      int pipelineRunLimit) {
    this(
        id,
        workspaceId,
        planKey,
        status,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        customerKey,
        memberLimit,
        datasetUploadLimit,
        pipelineRunLimit,
        List.of());
  }

  public static SubscriptionResult from(Subscription subscription, Plan plan) {
    return from(subscription, plan, List.of());
  }

  public static SubscriptionResult from(
      Subscription subscription, Plan plan, List<QuotaUsageResult> quotaUsages) {
    return new SubscriptionResult(
        subscription.getId(),
        subscription.getWorkspaceId(),
        plan.getPlanKey(),
        subscription.getStatus().name(),
        subscription.getCurrentPeriodStart(),
        subscription.getCurrentPeriodEnd(),
        subscription.isCancelAtPeriodEnd(),
        subscription.getCustomerKey(),
        plan.getMemberLimit(),
        plan.getDatasetUploadLimit(),
        plan.getPipelineRunLimit(),
        List.copyOf(quotaUsages));
  }
}
