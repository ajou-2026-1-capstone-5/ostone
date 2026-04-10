package com.init.auth.application.exception;

public class InvalidTokenException
    extends com.init.shared.application.exception.InvalidTokenException {
  public InvalidTokenException(String message) {
    super("INVALID_TOKEN", message);
  }
}
