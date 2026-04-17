package com.init.corpus.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class RawFileParseException extends BadRequestException {
  public RawFileParseException(String message) {
    super("VALIDATION_ERROR", message);
  }
}
