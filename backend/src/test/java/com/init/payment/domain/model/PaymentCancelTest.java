package com.init.payment.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("PaymentCancel 도메인")
class PaymentCancelTest {

  @Test
  @DisplayName("정상 파라미터로 생성 시 필드가 올바르게 설정된다")
  void create_success() {
    PaymentCancel cancel = PaymentCancel.create(10L, 5000L, "고객 요청", "txn_001");

    assertThat(cancel.getPaymentId()).isEqualTo(10L);
    assertThat(cancel.getCancelAmount()).isEqualTo(5000L);
    assertThat(cancel.getReason()).isEqualTo("고객 요청");
    assertThat(cancel.getTransactionKey()).isEqualTo("txn_001");
  }

  @Test
  @DisplayName("paymentId null이면 생성을 거부한다")
  void create_nullPaymentId_throws() {
    assertThatThrownBy(() -> PaymentCancel.create(null, 5000L, "reason", "txn"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("cancelAmount가 0이하이면 생성을 거부한다")
  void create_zeroOrNegativeAmount_throws() {
    assertThatThrownBy(() -> PaymentCancel.create(10L, 0L, "reason", "txn"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> PaymentCancel.create(10L, -1L, "reason", "txn"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("reason과 transactionKey는 null 허용이다")
  void create_nullOptionalFields_ok() {
    PaymentCancel cancel = PaymentCancel.create(10L, 5000L, null, null);

    assertThat(cancel.getReason()).isNull();
    assertThat(cancel.getTransactionKey()).isNull();
  }
}
