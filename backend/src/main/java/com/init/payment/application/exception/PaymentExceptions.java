package com.init.payment.application.exception;

import com.init.shared.application.exception.BadGatewayException;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.DuplicateException;
import com.init.shared.application.exception.InternalException;
import com.init.shared.application.exception.NotFoundException;

public final class PaymentExceptions {

  private PaymentExceptions() {}

  public static DuplicateException alreadyRefunded(String message) {
    return new DuplicateException("PAYMENT_ALREADY_REFUNDED", message);
  }

  public static InternalException configurationInvalid() {
    return new InternalException(
        "PAYMENT_CONFIGURATION_INVALID", "Payment gateway configuration is invalid.");
  }

  public static InternalException configurationInvalid(Throwable cause) {
    return new InternalException(
        "PAYMENT_CONFIGURATION_INVALID", "Payment gateway configuration is invalid.", cause);
  }

  public static BadRequestException gatewayRejected(String message) {
    return new BadRequestException("PAYMENT_GATEWAY_REJECTED", message);
  }

  public static BadGatewayException gatewayUnavailable(Throwable cause) {
    return new BadGatewayException(
        "PAYMENT_GATEWAY_UNAVAILABLE", "Toss cancel API request failed.", cause);
  }

  public static BadGatewayException gatewayUnavailable() {
    return new BadGatewayException(
        "PAYMENT_GATEWAY_UNAVAILABLE", "Toss cancel API request failed.");
  }

  public static NotFoundException notFound(String message) {
    return new NotFoundException("PAYMENT_NOT_FOUND", message);
  }

  public static BadRequestException notRefundable(String message) {
    return new BadRequestException("PAYMENT_NOT_REFUNDABLE", message);
  }
}
