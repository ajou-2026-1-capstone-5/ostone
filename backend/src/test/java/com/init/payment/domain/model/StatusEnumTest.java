package com.init.payment.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("Payment/Subscription 상태 열거형 유틸리티 메서드")
class StatusEnumTest {

  @Test
  @DisplayName("PaymentStatus.isDone() — DONE일 때만 true")
  void paymentStatus_isDone() {
    assertThat(PaymentStatus.DONE.isDone()).isTrue();
    assertThat(PaymentStatus.READY.isDone()).isFalse();
    assertThat(PaymentStatus.CANCELED.isDone()).isFalse();
  }

  @Test
  @DisplayName("PaymentStatus.isCanceled() — CANCELED 또는 PARTIAL_CANCELED일 때 true")
  void paymentStatus_isCanceled() {
    assertThat(PaymentStatus.CANCELED.isCanceled()).isTrue();
    assertThat(PaymentStatus.PARTIAL_CANCELED.isCanceled()).isTrue();
    assertThat(PaymentStatus.DONE.isCanceled()).isFalse();
    assertThat(PaymentStatus.ABORTED.isCanceled()).isFalse();
  }

  @Test
  @DisplayName("SubscriptionStatus.isActive() — ACTIVE일 때만 true")
  void subscriptionStatus_isActive() {
    assertThat(SubscriptionStatus.ACTIVE.isActive()).isTrue();
    assertThat(SubscriptionStatus.INCOMPLETE.isActive()).isFalse();
    assertThat(SubscriptionStatus.PAST_DUE.isActive()).isFalse();
    assertThat(SubscriptionStatus.CANCELED.isActive()).isFalse();
  }

  @Test
  @DisplayName("SubscriptionStatus.isTerminated() — CANCELED일 때만 true")
  void subscriptionStatus_isTerminated() {
    assertThat(SubscriptionStatus.CANCELED.isTerminated()).isTrue();
    assertThat(SubscriptionStatus.ACTIVE.isTerminated()).isFalse();
    assertThat(SubscriptionStatus.PAST_DUE.isTerminated()).isFalse();
  }
}
