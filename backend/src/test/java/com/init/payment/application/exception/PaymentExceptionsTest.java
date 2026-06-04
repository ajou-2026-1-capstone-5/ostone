package com.init.payment.application.exception;

import static org.assertj.core.api.Assertions.assertThat;

import com.init.shared.application.exception.BadGatewayException;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.BusinessException;
import com.init.shared.application.exception.DuplicateException;
import com.init.shared.application.exception.InternalException;
import com.init.shared.application.exception.NotFoundException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("PaymentExceptions")
class PaymentExceptionsTest {

  @Test
  @DisplayName("payment 예외 코드를 생성한다")
  void should_결제예외코드생성() {
    assertCode(
        PaymentExceptions.alreadyRefunded("이미 환불"),
        "PAYMENT_ALREADY_REFUNDED",
        DuplicateException.class);
    assertCode(
        PaymentExceptions.configurationInvalid(),
        "PAYMENT_CONFIGURATION_INVALID",
        InternalException.class);
    assertCode(
        PaymentExceptions.configurationInvalid(new IllegalArgumentException()),
        "PAYMENT_CONFIGURATION_INVALID",
        InternalException.class);
    assertCode(
        PaymentExceptions.gatewayRejected("거절"),
        "PAYMENT_GATEWAY_REJECTED",
        BadRequestException.class);
    assertCode(
        PaymentExceptions.gatewayUnavailable(new IllegalStateException()),
        "PAYMENT_GATEWAY_UNAVAILABLE",
        BadGatewayException.class);
    assertCode(PaymentExceptions.notFound("없음"), "PAYMENT_NOT_FOUND", NotFoundException.class);
    assertCode(
        PaymentExceptions.notRefundable("불가"), "PAYMENT_NOT_REFUNDABLE", BadRequestException.class);
  }

  private void assertCode(
      BusinessException exception, String code, Class<? extends BusinessException> type) {
    assertThat(exception).isInstanceOf(type);
    assertThat(exception.getCode()).isEqualTo(code);
  }
}
