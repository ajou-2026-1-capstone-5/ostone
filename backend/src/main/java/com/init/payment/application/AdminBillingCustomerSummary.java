package com.init.payment.application;

import java.time.OffsetDateTime;
import org.springframework.lang.Nullable;

public record AdminBillingCustomerSummary(
    Long workspaceId,
    String workspaceKey,
    String workspaceName,
    @Nullable String subscriptionStatus,
    @Nullable OffsetDateTime currentPeriodStart,
    @Nullable OffsetDateTime currentPeriodEnd,
    @Nullable OffsetDateTime nextBillingAt,
    @Nullable String planName,
    @Nullable Long planAmount,
    @Nullable Long recentPaymentId,
    @Nullable Long recentPaymentAmount,
    @Nullable String recentPaymentStatus,
    @Nullable OffsetDateTime recentPaymentApprovedAt,
    @Nullable String failedStatus) {}
