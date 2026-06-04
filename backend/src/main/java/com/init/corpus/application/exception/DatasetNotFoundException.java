package com.init.corpus.application.exception;

import com.init.shared.application.exception.NotFoundException;

public class DatasetNotFoundException extends NotFoundException {
  public DatasetNotFoundException(String message) {
    super("DATASET_NOT_FOUND", message);
  }
}
