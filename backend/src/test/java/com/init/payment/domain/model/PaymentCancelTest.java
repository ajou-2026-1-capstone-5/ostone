package com.init.payment.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

@DisplayName("PaymentCancel 도메인")
class PaymentCancelTest {

  @Test
  @DisplayName("정상 파라미터로 생성 시 필드가 올바르게 설정된다")
  void create_success() {
    PaymentCancel cancel = PaymentCancel.create(10L, 5000L, "고객 요청", "txn_001", "idem_001");

    assertThat(cancel.getPaymentId()).isEqualTo(10L);
    assertThat(cancel.getCancelAmount()).isEqualTo(5000L);
    assertThat(cancel.getReason()).isEqualTo("고객 요청");
    assertThat(cancel.getTransactionKey()).isEqualTo("txn_001");
    assertThat(cancel.getIdempotencyKey()).isEqualTo("idem_001");
  }

  @Test
  @DisplayName("paymentId null이면 생성을 거부한다")
  void create_nullPaymentId_throws() {
    assertThatThrownBy(() -> PaymentCancel.create(null, 5000L, "reason", "txn", "idem"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("cancelAmount가 0이하이면 생성을 거부한다")
  void create_zeroOrNegativeAmount_throws() {
    assertThatThrownBy(() -> PaymentCancel.create(10L, 0L, "reason", "txn", "idem"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> PaymentCancel.create(10L, -1L, "reason", "txn", "idem"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("reason과 transactionKey와 idempotencyKey는 null 허용이다")
  void create_nullOptionalFields_ok() {
    PaymentCancel cancel = PaymentCancel.create(10L, 5000L, null, null, null);

    assertThat(cancel.getReason()).isNull();
    assertThat(cancel.getTransactionKey()).isNull();
    assertThat(cancel.getIdempotencyKey()).isNull();
  }

  @Test
  @DisplayName("취소 시각은 명시값을 보존하고 없으면 저장 시점에 채운다")
  void create_canceledAt() {
    OffsetDateTime canceledAt = OffsetDateTime.parse("2026-06-03T12:00:00Z");
    PaymentCancel explicit = PaymentCancel.create(10L, 5000L, "고객 요청", "txn_001", null, canceledAt);
    PaymentCancel defaulted = PaymentCancel.create(10L, 5000L, "고객 요청", "txn_002", null);

    ReflectionTestUtils.invokeMethod(explicit, "onPersist");
    ReflectionTestUtils.invokeMethod(defaulted, "onPersist");

    assertThat(explicit.getCanceledAt()).isEqualTo(canceledAt);
    assertThat(defaulted.getCanceledAt()).isNotNull();
  }
}
