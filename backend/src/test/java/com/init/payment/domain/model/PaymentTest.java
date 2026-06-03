package com.init.payment.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("Payment 도메인")
class PaymentTest {

  private static final OffsetDateTime NOW =
      OffsetDateTime.ofInstant(Instant.parse("2026-06-01T00:00:00Z"), ZoneOffset.UTC);

  @Test
  @DisplayName("주문 생성 시 READY 상태이며 기대 금액을 보관한다")
  void createOrder_isReady() {
    Payment payment = Payment.createOrder(1L, 5L, "ord_1", 29000, "KRW", "Pro");

    assertThat(payment.getStatus()).isEqualTo(PaymentStatus.READY);
    assertThat(payment.matchesAmount(29000)).isTrue();
    assertThat(payment.matchesAmount(10000)).isFalse();
    assertThat(payment.isDone()).isFalse();
  }

  @Test
  @DisplayName("정기결제 생성 시 IN_PROGRESS이며 주기 키를 보관한다 (U-011)")
  void createRecurring_hasPeriodKey() {
    Payment payment =
        Payment.createRecurring(
            1L, 5L, "ord_2", 29000, "KRW", "Pro", "2026-07-01T00:00:00Z", "idem");

    assertThat(payment.getStatus()).isEqualTo(PaymentStatus.IN_PROGRESS);
    assertThat(payment.getBillingPeriodKey()).isEqualTo("2026-07-01T00:00:00Z");
  }

  @Test
  @DisplayName("승인 완료 시 DONE으로 전이하고 결제 정보를 채운다")
  void complete_transitionsToDone() {
    Payment payment = Payment.createOrder(1L, 5L, "ord_1", 29000, "KRW", "Pro");
    OffsetDateTime approvedAt = OffsetDateTime.parse("2026-06-01T00:00:00Z");

    payment.complete("pay_key", "카드", approvedAt, "https://receipt", "{\"status\":\"DONE\"}");

    assertThat(payment.getStatus()).isEqualTo(PaymentStatus.DONE);
    assertThat(payment.getPaymentKey()).isEqualTo("pay_key");
    assertThat(payment.getApprovedAt()).isEqualTo(approvedAt);
    assertThat(payment.isDone()).isTrue();
  }

  @Test
  @DisplayName("취소/부분취소/중단 상태 전이 — 선행 상태 요건 준수")
  void cancelTransitions() {
    Payment canceled = Payment.createOrder(1L, 5L, "ord_a", 29000, "KRW", "Pro");
    canceled.complete("pay_a", "카드", NOW, null, "{}");
    canceled.markCanceled("{}");
    assertThat(canceled.getStatus()).isEqualTo(PaymentStatus.CANCELED);

    Payment partial = Payment.createOrder(1L, 5L, "ord_b", 29000, "KRW", "Pro");
    partial.complete("pay_b", "카드", NOW, null, "{}");
    partial.markPartialCanceled("{}");
    assertThat(partial.getStatus()).isEqualTo(PaymentStatus.PARTIAL_CANCELED);

    Payment aborted = Payment.createOrder(1L, 5L, "ord_c", 29000, "KRW", "Pro");
    aborted.markAborted("{}");
    assertThat(aborted.getStatus()).isEqualTo(PaymentStatus.ABORTED);
  }

  @Test
  @DisplayName("잘못된 선행 상태에서 상태 전이 시 IllegalStateException을 던진다 (V-NEW-005)")
  void stateTransition_wrongPrecondition_throws() {
    Payment readyPayment = Payment.createOrder(1L, 5L, "ord_x", 29000, "KRW", "Pro");

    assertThatThrownBy(() -> readyPayment.markCanceled("{}"))
        .isInstanceOf(IllegalStateException.class);
    assertThatThrownBy(() -> readyPayment.markPartialCanceled("{}"))
        .isInstanceOf(IllegalStateException.class);

    Payment donePayment = Payment.createOrder(1L, 5L, "ord_y", 29000, "KRW", "Pro");
    donePayment.complete("pay_y", "카드", NOW, null, "{}");

    assertThatThrownBy(() -> donePayment.markAborted("{}"))
        .isInstanceOf(IllegalStateException.class);
    assertThatThrownBy(() -> donePayment.complete("pay_y2", "카드", NOW, null, "{}"))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  @DisplayName("정기결제 생성 시 billingPeriodKey/idempotencyKey null이면 거부한다 (V-NEW-004)")
  void createRecurring_nullKeys_rejected() {
    assertThatThrownBy(
            () -> Payment.createRecurring(1L, 5L, "ord_2", 29000, "KRW", "Pro", null, "idem"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(
            () -> Payment.createRecurring(1L, 5L, "ord_2", 29000, "KRW", "Pro", "period", null))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(
            () -> Payment.createRecurring(1L, 5L, "ord_2", 29000, "KRW", "Pro", "", "idem"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("음수 금액 주문은 거부한다")
  void negativeAmount_rejected() {
    assertThatThrownBy(() -> Payment.createOrder(1L, 5L, "ord_1", -1, "KRW", "Pro"))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
