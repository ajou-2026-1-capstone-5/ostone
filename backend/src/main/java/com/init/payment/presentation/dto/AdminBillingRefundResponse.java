package com.init.payment.presentation.dto;

import com.init.payment.application.AdminBillingRefundResult;
import java.time.OffsetDateTime;

public record AdminBillingRefundResponse(
    Long paymentId,
    Long workspaceId,
    Long refundAmount,
    String paymentStatus,
    String transactionKey,
    OffsetDateTime canceledAt,
    String reason) {

  public static AdminBillingRefundResponse from(AdminBillingRefundResult result) {
    return new AdminBillingRefundResponse(
        result.paymentId(),
        result.workspaceId(),
        result.refundAmount(),
        result.paymentStatus().name(),
        result.transactionKey(),
        result.canceledAt(),
        result.reason());
  }
}
