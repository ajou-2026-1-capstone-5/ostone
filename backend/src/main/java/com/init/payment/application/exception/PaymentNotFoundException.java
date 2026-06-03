package com.init.payment.application.exception;

import com.init.shared.application.exception.NotFoundException;

public class PaymentNotFoundException extends NotFoundException {
  public PaymentNotFoundException(String reference) {
    super("PAYMENT_NOT_FOUND", "결제 내역을 찾을 수 없습니다. " + reference);
  }
}
