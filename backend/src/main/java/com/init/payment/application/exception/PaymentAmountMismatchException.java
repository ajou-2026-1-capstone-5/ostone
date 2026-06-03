package com.init.payment.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class PaymentAmountMismatchException extends BadRequestException {
  public PaymentAmountMismatchException(long expected, long actual) {
    super(
        "PAYMENT_AMOUNT_MISMATCH", "결제 금액이 일치하지 않습니다. expected=" + expected + ", actual=" + actual);
  }
}
