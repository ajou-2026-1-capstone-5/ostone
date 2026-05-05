package com.init.shared.application.exception;

public class BadGatewayException extends BusinessException {

  public BadGatewayException(String code, String message) {
    super(code, message);
  }
}
