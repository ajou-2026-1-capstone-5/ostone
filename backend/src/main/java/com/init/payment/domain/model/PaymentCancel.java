package com.init.payment.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

@Entity
@Table(name = "payment_cancel", schema = "payment")
public class PaymentCancel {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "payment_id", nullable = false)
  private Long paymentId;

  @Column(name = "cancel_amount", nullable = false)
  private long cancelAmount;

  @Column(name = "reason")
  private String reason;

  @Column(name = "transaction_key")
  private String transactionKey;

  @Column(name = "idempotency_key")
  private String idempotencyKey;

  @Column(name = "canceled_at", nullable = false, updatable = false)
  private OffsetDateTime canceledAt;

  protected PaymentCancel() {}

  public static PaymentCancel create(
      Long paymentId,
      long cancelAmount,
      String reason,
      String transactionKey,
      String idempotencyKey) {
    return create(paymentId, cancelAmount, reason, transactionKey, idempotencyKey, null);
  }

  public static PaymentCancel create(
      Long paymentId,
      long cancelAmount,
      String reason,
      String transactionKey,
      String idempotencyKey,
      OffsetDateTime canceledAt) {
    if (paymentId == null) {
      throw new IllegalArgumentException("paymentId must not be null");
    }
    if (cancelAmount <= 0) {
      throw new IllegalArgumentException("cancelAmount must be positive: " + cancelAmount);
    }

    PaymentCancel cancel = new PaymentCancel();
    cancel.paymentId = paymentId;
    cancel.cancelAmount = cancelAmount;
    cancel.reason = reason;
    cancel.transactionKey = transactionKey;
    cancel.idempotencyKey = idempotencyKey;
    cancel.canceledAt = canceledAt;
    return cancel;
  }

  @PrePersist
  protected void onPersist() {
    if (canceledAt == null) {
      this.canceledAt = OffsetDateTime.now();
    }
  }

  public Long getId() {
    return id;
  }

  public Long getPaymentId() {
    return paymentId;
  }

  public long getCancelAmount() {
    return cancelAmount;
  }

  public String getReason() {
    return reason;
  }

  public String getTransactionKey() {
    return transactionKey;
  }

  public String getIdempotencyKey() {
    return idempotencyKey;
  }

  public OffsetDateTime getCanceledAt() {
    return canceledAt;
  }
}
