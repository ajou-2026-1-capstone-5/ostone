package com.init.shared.application.exception;

public class BadGatewayException extends BusinessException {

  public BadGatewayException(String code, String message) {
    super(code, message);
  }

  public BadGatewayException(String code, String message, Throwable cause) {
    super(code, message, cause);
  }
}
