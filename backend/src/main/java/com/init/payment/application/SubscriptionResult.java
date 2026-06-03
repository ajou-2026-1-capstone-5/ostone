package com.init.payment.application;

import com.init.payment.domain.model.Plan;
import com.init.payment.domain.model.Subscription;
import java.time.OffsetDateTime;

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
    int pipelineRunLimit) {

  public static SubscriptionResult from(Subscription subscription, Plan plan) {
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
        plan.getPipelineRunLimit());
  }
}
