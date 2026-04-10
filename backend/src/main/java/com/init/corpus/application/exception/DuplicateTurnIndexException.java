package com.init.corpus.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class DuplicateTurnIndexException extends BadRequestException {
  public DuplicateTurnIndexException(String message) {
    super("DUPLICATE_TURN_INDEX", message);
  }
}
