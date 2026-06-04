package com.init.payment.application;

import com.init.payment.domain.model.PaymentStatus;
import java.time.OffsetDateTime;

public record AdminBillingRefundResult(
    Long paymentId,
    Long workspaceId,
    Long refundAmount,
    PaymentStatus paymentStatus,
    String transactionKey,
    OffsetDateTime canceledAt,
    String reason) {}
