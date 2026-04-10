package com.init.shared.application.exception;

public class InvalidCredentialsException extends BusinessException {
  public InvalidCredentialsException(String code, String message) {
    super(code, message);
  }
}
