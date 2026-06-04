package com.init.payment.presentation.dto;

import com.init.payment.application.AdminBillingCustomerSummary;
import java.time.OffsetDateTime;
import org.springframework.lang.Nullable;

public record AdminBillingCustomerResponse(
    Long workspaceId,
    String workspaceKey,
    String workspaceName,
    SubscriptionView subscription,
    @Nullable PaymentView recentPayment,
    @Nullable String failedStatus) {

  public static AdminBillingCustomerResponse from(AdminBillingCustomerSummary summary) {
    return new AdminBillingCustomerResponse(
        summary.workspaceId(),
        summary.workspaceKey(),
        summary.workspaceName(),
        new SubscriptionView(
            summary.subscriptionStatus(),
            summary.currentPeriodStart(),
            summary.currentPeriodEnd(),
            summary.nextBillingAt(),
            summary.planName(),
            summary.planAmount()),
        paymentView(summary),
        summary.failedStatus());
  }

  @Nullable
  private static PaymentView paymentView(AdminBillingCustomerSummary summary) {
    if (summary.recentPaymentId() == null) {
      return null;
    }
    return new PaymentView(
        summary.recentPaymentId(),
        summary.recentPaymentAmount(),
        summary.recentPaymentStatus(),
        summary.recentPaymentApprovedAt());
  }

  public record SubscriptionView(
      @Nullable String status,
      @Nullable OffsetDateTime currentPeriodStart,
      @Nullable OffsetDateTime currentPeriodEnd,
      @Nullable OffsetDateTime nextBillingAt,
      @Nullable String planName,
      @Nullable Long planAmount) {}

  public record PaymentView(
      Long id,
      @Nullable Long amount,
      @Nullable String status,
      @Nullable OffsetDateTime approvedAt) {}
}
