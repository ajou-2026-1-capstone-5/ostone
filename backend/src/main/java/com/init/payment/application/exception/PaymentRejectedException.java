package com.init.payment.application.exception;

import com.init.shared.application.exception.BadRequestException;

/** Toss가 4xx로 거절한 결제(카드 거절, 잘못된 요청 등) (U-008). */
public class PaymentRejectedException extends BadRequestException {

  public PaymentRejectedException(String message) {
    super("PAYMENT_REJECTED", message);
  }

  public PaymentRejectedException(String message, Throwable cause) {
    super("PAYMENT_REJECTED", message, cause);
  }
}
