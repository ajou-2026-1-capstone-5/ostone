package com.init.shared.application.exception;

public class InvalidTokenException extends BusinessException {
  public InvalidTokenException(String code, String message) {
    super(code, message);
  }

  public InvalidTokenException(String message, Throwable cause) {
    super("INVALID_TOKEN", message, cause);
  }
}
