package com.init.corpus.application.exception;

import com.init.shared.application.exception.DuplicateException;

public class DatasetKeyConflictException extends DuplicateException {
  public DatasetKeyConflictException(String message) {
    super("DATASET_KEY_CONFLICT", message);
  }
}
