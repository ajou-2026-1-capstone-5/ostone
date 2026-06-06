package com.init.payment.presentation.dto;

import com.init.payment.application.SubscriptionResult;
import java.time.OffsetDateTime;
import java.util.List;

public record SubscriptionResponse(
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
    List<QuotaUsageResponse> quotaUsages) {

  public static SubscriptionResponse from(SubscriptionResult result) {
    return new SubscriptionResponse(
        result.id(),
        result.workspaceId(),
        result.planKey(),
        result.status(),
        result.currentPeriodStart(),
        result.currentPeriodEnd(),
        result.cancelAtPeriodEnd(),
        result.customerKey(),
        result.memberLimit(),
        result.datasetUploadLimit(),
        result.pipelineRunLimit(),
        result.quotaUsages().stream().map(QuotaUsageResponse::from).toList());
  }
}
