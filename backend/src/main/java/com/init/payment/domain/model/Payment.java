package com.init.payment.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "payment", schema = "payment")
public class Payment {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "order_id", nullable = false, unique = true)
  private String orderId;

  @Column(name = "payment_key")
  private String paymentKey;

  @Column(name = "workspace_id", nullable = false)
  private Long workspaceId;

  @Column(name = "subscription_id")
  private Long subscriptionId;

  @Column(name = "amount", nullable = false)
  private long amount;

  @Column(name = "currency", nullable = false)
  private String currency;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false)
  private PaymentStatus status;

  @Column(name = "method")
  private String method;

  @Column(name = "order_name")
  private String orderName;

  @Column(name = "billing_period_key")
  private String billingPeriodKey;

  @Column(name = "approved_at")
  private OffsetDateTime approvedAt;

  @Column(name = "receipt_url")
  private String receiptUrl;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "raw_response", columnDefinition = "jsonb")
  private String rawResponse;

  @Column(name = "idempotency_key")
  private String idempotencyKey;

  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  protected Payment() {}

  /** 위젯 일회성 결제 주문(READY). confirm 시 기대 금액 검증 기준이 된다. */
  public static Payment createOrder(
      Long workspaceId,
      Long subscriptionId,
      String orderId,
      long amount,
      String currency,
      String orderName) {
    Payment payment = baseOrder(workspaceId, subscriptionId, orderId, amount, currency, orderName);
    payment.status = PaymentStatus.READY;
    return payment;
  }

  /** 정기결제 시도(IN_PROGRESS). billingPeriodKey로 동주기 중복청구를 차단한다 (U-011). */
  public static Payment createRecurring(
      Long workspaceId,
      Long subscriptionId,
      String orderId,
      long amount,
      String currency,
      String orderName,
      String billingPeriodKey,
      String idempotencyKey) {
    Payment payment = baseOrder(workspaceId, subscriptionId, orderId, amount, currency, orderName);
    payment.status = PaymentStatus.IN_PROGRESS;
    payment.billingPeriodKey = billingPeriodKey;
    payment.idempotencyKey = idempotencyKey;
    return payment;
  }

  private static Payment baseOrder(
      Long workspaceId,
      Long subscriptionId,
      String orderId,
      long amount,
      String currency,
      String orderName) {
    if (workspaceId == null) {
      throw new IllegalArgumentException("workspaceId must not be null");
    }
    if (orderId == null || orderId.isBlank()) {
      throw new IllegalArgumentException("orderId must not be blank");
    }

    Money money = Money.of(amount, currency);
    Payment payment = new Payment();
    payment.amount = money.amount();
    payment.currency = money.currency();
    payment.workspaceId = workspaceId;
    payment.subscriptionId = subscriptionId;
    payment.orderId = orderId;
    payment.orderName = orderName;
    return payment;
  }

  /** 결제 승인 완료. READY/IN_PROGRESS -> DONE. */
  public void complete(
      String paymentKey,
      String method,
      OffsetDateTime approvedAt,
      String receiptUrl,
      String rawResponse) {
    this.status = PaymentStatus.DONE;
    this.paymentKey = paymentKey;
    this.method = method;
    this.approvedAt = approvedAt;
    this.receiptUrl = receiptUrl;
    this.rawResponse = rawResponse;
  }

  /** 결제 실패/중단. -> ABORTED. */
  public void markAborted(String rawResponse) {
    this.status = PaymentStatus.ABORTED;
    this.rawResponse = rawResponse;
  }

  /** 전액 취소. DONE -> CANCELED. */
  public void markCanceled(String rawResponse) {
    this.status = PaymentStatus.CANCELED;
    this.rawResponse = rawResponse;
  }

  /** 부분 취소. DONE -> PARTIAL_CANCELED. */
  public void markPartialCanceled(String rawResponse) {
    this.status = PaymentStatus.PARTIAL_CANCELED;
    this.rawResponse = rawResponse;
  }

  public boolean isDone() {
    return status == PaymentStatus.DONE;
  }

  public boolean matchesAmount(long requested) {
    return this.amount == requested;
  }

  public Money money() {
    return Money.of(amount, currency);
  }

  @PrePersist
  protected void onPersist() {
    OffsetDateTime now = OffsetDateTime.now();
    this.createdAt = now;
    this.updatedAt = now;
  }

  @PreUpdate
  protected void onUpdate() {
    this.updatedAt = OffsetDateTime.now();
  }

  public Long getId() {
    return id;
  }

  public String getOrderId() {
    return orderId;
  }

  public String getPaymentKey() {
    return paymentKey;
  }

  public Long getWorkspaceId() {
    return workspaceId;
  }

  public Long getSubscriptionId() {
    return subscriptionId;
  }

  public long getAmount() {
    return amount;
  }

  public String getCurrency() {
    return currency;
  }

  public PaymentStatus getStatus() {
    return status;
  }

  public String getMethod() {
    return method;
  }

  public String getOrderName() {
    return orderName;
  }

  public String getBillingPeriodKey() {
    return billingPeriodKey;
  }

  public OffsetDateTime getApprovedAt() {
    return approvedAt;
  }

  public String getReceiptUrl() {
    return receiptUrl;
  }

  public String getIdempotencyKey() {
    return idempotencyKey;
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }

  public OffsetDateTime getUpdatedAt() {
    return updatedAt;
  }
}
