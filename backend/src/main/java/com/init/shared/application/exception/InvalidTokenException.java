package com.init.shared.application.exception;

public class InvalidTokenException extends BusinessException {
  public InvalidTokenException(String code, String message) {
    super(code, message);
  }
}
