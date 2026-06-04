package com.init.corpus.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class InvalidUploadStateException extends BadRequestException {
  public InvalidUploadStateException(String message) {
    super("VALIDATION_ERROR", message);
  }
}
