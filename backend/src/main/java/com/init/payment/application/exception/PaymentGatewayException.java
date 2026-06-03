package com.init.payment.application.exception;

import com.init.shared.application.exception.BadGatewayException;

/** Toss 게이트웨이 오류(5xx/timeout/통신 실패) (U-008). */
public class PaymentGatewayException extends BadGatewayException {

  public PaymentGatewayException(String message) {
    super("PAYMENT_GATEWAY_ERROR", message);
  }

  public PaymentGatewayException(String message, Throwable cause) {
    super("PAYMENT_GATEWAY_ERROR", message, cause);
  }
}
