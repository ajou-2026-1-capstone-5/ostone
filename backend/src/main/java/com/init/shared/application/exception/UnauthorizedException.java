package com.init.shared.application.exception;

public class UnauthorizedException extends BusinessException {
  public UnauthorizedException(String code, String message) {
    super(code, message);
  }
}
