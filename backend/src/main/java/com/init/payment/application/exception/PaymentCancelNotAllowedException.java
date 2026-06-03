package com.init.payment.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class PaymentCancelNotAllowedException extends BadRequestException {
  public PaymentCancelNotAllowedException(String message) {
    super("PAYMENT_CANCEL_NOT_ALLOWED", message);
  }
}
