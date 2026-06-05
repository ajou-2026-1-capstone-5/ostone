package com.init.payment.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

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
    partial.markCanceled("{}");
    assertThat(partial.getStatus()).isEqualTo(PaymentStatus.CANCELED);

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

  @Test
  @DisplayName("refundFull: DONE 결제를 CANCELED로 전이하고 전액 취소 기록을 만든다")
  void refundFull_cancelsDonePayment() {
    Payment payment = completedPayment("ord_refund_1");
    OffsetDateTime canceledAt = OffsetDateTime.parse("2026-06-02T00:00:00Z");

    PaymentCancel cancel = payment.refundFull("고객 요청", "tx_cancel_1", canceledAt);

    assertThat(payment.getStatus()).isEqualTo(PaymentStatus.CANCELED);
    assertThat(cancel.getPaymentId()).isEqualTo(100L);
    assertThat(cancel.getCancelAmount()).isEqualTo(29000L);
    assertThat(cancel.getReason()).isEqualTo("고객 요청");
    assertThat(cancel.getTransactionKey()).isEqualTo("tx_cancel_1");
    assertThat(cancel.getCanceledAt()).isEqualTo(canceledAt);
  }

  @Test
  @DisplayName("refundFull: DONE이 아닌 결제는 전액 환불할 수 없다")
  void refundFull_requiresDonePayment() {
    Payment payment = Payment.createOrder(1L, 5L, "ord_ready", 29000, "KRW", "Pro");

    assertThatThrownBy(() -> payment.refundFull("고객 요청", "tx_cancel_1", NOW))
        .isInstanceOf(IllegalStateException.class)
        .hasMessage("DONE payment is required for full refund");
  }

  @Test
  @DisplayName("refundFull: reason과 transactionKey는 필수다")
  void refundFull_requiresReasonAndTransactionKey() {
    Payment missingReason = completedPayment("ord_refund_2");
    Payment missingTransactionKey = completedPayment("ord_refund_3");

    assertThatThrownBy(() -> missingReason.refundFull(" ", "tx_cancel_1", NOW))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessage("reason must not be null or blank");
    assertThatThrownBy(() -> missingTransactionKey.refundFull("고객 요청", " ", NOW))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessage("transactionKey must not be null or blank");
  }

  @Test
  @DisplayName("refundFull: 취소 시각이 없으면 저장 시점에 채울 수 있도록 null을 허용한다")
  void refundFull_allowsNullCanceledAt() {
    Payment payment = completedPayment("ord_refund_4");

    PaymentCancel cancel = payment.refundFull("고객 요청", "tx_cancel_1", null);

    assertThat(cancel.getCanceledAt()).isNull();
  }

  private Payment completedPayment(String orderId) {
    Payment payment = Payment.createOrder(1L, 5L, orderId, 29000, "KRW", "Pro");
    ReflectionTestUtils.setField(payment, "id", 100L);
    payment.complete("pay_" + orderId, "카드", NOW, "https://receipt", "{}");
    return payment;
  }
}
