package com.init.payment.application;

import com.init.shared.application.exception.BadRequestException;

public record AdminBillingRefundCommand(Long paymentId, String reason) {
  public AdminBillingRefundCommand {
    if (paymentId == null) {
      throw new BadRequestException("PAYMENT_INVALID_REFUND_REQUEST", "paymentId must not be null");
    }
    if (reason == null || reason.isBlank()) {
      throw new BadRequestException(
          "PAYMENT_INVALID_REFUND_REQUEST", "reason must not be null or blank");
    }
  }
}
