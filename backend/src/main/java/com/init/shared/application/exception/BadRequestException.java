package com.init.shared.application.exception;

public class BadRequestException extends BusinessException {
  public BadRequestException(String code, String message) {
    super(code, message);
  }
}
