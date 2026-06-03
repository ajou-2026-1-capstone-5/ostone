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

@Entity
@Table(name = "subscription", schema = "payment")
public class Subscription {

  /** 초기 실패 1회 + 일 1회 재시도 3회 = 4회차 실패 시 해지 (U-004). */
  public static final int MAX_RECURRING_ATTEMPTS = 4;

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "workspace_id", nullable = false)
  private Long workspaceId;

  @Column(name = "plan_id", nullable = false)
  private Long planId;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false)
  private SubscriptionStatus status;

  @Column(name = "current_period_start")
  private OffsetDateTime currentPeriodStart;

  @Column(name = "current_period_end")
  private OffsetDateTime currentPeriodEnd;

  @Column(name = "customer_key")
  private String customerKey;

  @Column(name = "cancel_at_period_end", nullable = false)
  private boolean cancelAtPeriodEnd;

  @Column(name = "failed_attempt_count", nullable = false)
  private int failedAttemptCount;

  @Column(name = "next_retry_at")
  private OffsetDateTime nextRetryAt;

  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  protected Subscription() {}

  public static Subscription create(Long workspaceId, Long planId) {
    if (workspaceId == null) {
      throw new IllegalArgumentException("workspaceId must not be null");
    }
    if (planId == null) {
      throw new IllegalArgumentException("planId must not be null");
    }
    Subscription subscription = new Subscription();
    subscription.workspaceId = workspaceId;
    subscription.planId = planId;
    subscription.status = SubscriptionStatus.INCOMPLETE;
    subscription.cancelAtPeriodEnd = false;
    subscription.failedAttemptCount = 0;
    return subscription;
  }

  /** 워크스페이스 단위 customerKey 부여 (U-006). 최초 1회 생성 후 재사용. */
  public void assignCustomerKey(String customerKey) {
    if (customerKey == null || customerKey.isBlank()) {
      throw new IllegalArgumentException("customerKey must not be blank");
    }
    this.customerKey = customerKey;
  }

  /** 첫 결제 성공 시 구독 활성화. INCOMPLETE/PAST_DUE -> ACTIVE. */
  public void activate(OffsetDateTime periodStart, OffsetDateTime periodEnd, String customerKey) {
    if (status == SubscriptionStatus.CANCELED) {
      throw new IllegalStateException("취소된 구독은 활성화할 수 없습니다.");
    }
    this.status = SubscriptionStatus.ACTIVE;
    this.currentPeriodStart = periodStart;
    this.currentPeriodEnd = periodEnd;
    if (customerKey != null) {
      this.customerKey = customerKey;
    }
    this.failedAttemptCount = 0;
    this.nextRetryAt = null;
  }

  /** 정기결제 성공으로 다음 주기로 갱신. ACTIVE 유지. */
  public void renew(OffsetDateTime periodStart, OffsetDateTime periodEnd) {
    this.status = SubscriptionStatus.ACTIVE;
    this.currentPeriodStart = periodStart;
    this.currentPeriodEnd = periodEnd;
    this.failedAttemptCount = 0;
    this.nextRetryAt = null;
  }

  /** PAST_DUE 상태에서 재시도 성공으로 복구. */
  public void recover(OffsetDateTime periodStart, OffsetDateTime periodEnd) {
    renew(periodStart, periodEnd);
  }

  /** 정기결제 실패. ACTIVE/PAST_DUE -> PAST_DUE, 실패 카운트 증가. */
  public void markPastDue(OffsetDateTime nextRetryAt) {
    this.status = SubscriptionStatus.PAST_DUE;
    this.failedAttemptCount += 1;
    this.nextRetryAt = nextRetryAt;
  }

  /** 사용자 취소 또는 재시도 소진으로 즉시 해지. */
  public void cancel() {
    this.status = SubscriptionStatus.CANCELED;
    this.nextRetryAt = null;
  }

  /** 기간말 해지 예약 (U-005). ACTIVE 유지, 기간 종료 시 스케줄러가 해지. */
  public void scheduleCancelAtPeriodEnd() {
    if (status == SubscriptionStatus.CANCELED) {
      throw new IllegalStateException("이미 해지된 구독입니다.");
    }
    this.cancelAtPeriodEnd = true;
  }

  public boolean isRetryExhausted() {
    return failedAttemptCount >= MAX_RECURRING_ATTEMPTS;
  }

  public boolean isActive() {
    return status == SubscriptionStatus.ACTIVE;
  }

  public Long getId() {
    return id;
  }

  public Long getWorkspaceId() {
    return workspaceId;
  }

  public Long getPlanId() {
    return planId;
  }

  public SubscriptionStatus getStatus() {
    return status;
  }

  public OffsetDateTime getCurrentPeriodStart() {
    return currentPeriodStart;
  }

  public OffsetDateTime getCurrentPeriodEnd() {
    return currentPeriodEnd;
  }

  public String getCustomerKey() {
    return customerKey;
  }

  public boolean isCancelAtPeriodEnd() {
    return cancelAtPeriodEnd;
  }

  public int getFailedAttemptCount() {
    return failedAttemptCount;
  }

  public OffsetDateTime getNextRetryAt() {
    return nextRetryAt;
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }

  public OffsetDateTime getUpdatedAt() {
    return updatedAt;
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
}
