package com.init.auth.application.exception;

public class BadRequestException extends com.init.shared.application.exception.BadRequestException {
  public BadRequestException(String message) {
    super("BAD_REQUEST", message);
  }
}
