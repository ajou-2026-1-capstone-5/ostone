package com.init.shared.application.exception;

public class NotFoundException extends BusinessException {
  public NotFoundException(String code, String message) {
    super(code, message);
  }
}
