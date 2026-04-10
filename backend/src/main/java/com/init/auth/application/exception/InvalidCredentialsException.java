package com.init.auth.application.exception;

public class InvalidCredentialsException extends com.init.shared.application.exception.InvalidCredentialsException {
  public InvalidCredentialsException(String message) {
    super("INVALID_CREDENTIALS", message);
  }
}
