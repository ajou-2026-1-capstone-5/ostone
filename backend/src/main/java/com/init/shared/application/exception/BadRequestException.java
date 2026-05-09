package com.init.shared.application.exception;

public class BadRequestException extends BusinessException {
  public BadRequestException(String code, String message) {
    super(code, message);
  }

  public BadRequestException(String code, String message, Throwable cause) {
    super(code, message, cause);
  }
}
