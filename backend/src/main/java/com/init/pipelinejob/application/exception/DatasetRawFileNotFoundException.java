package com.init.pipelinejob.application.exception;

import com.init.shared.application.exception.NotFoundException;

public class DatasetRawFileNotFoundException extends NotFoundException {

  public DatasetRawFileNotFoundException(Long datasetId) {
    super("RAW_FILE_NOT_FOUND", "Dataset raw file을 찾을 수 없습니다. datasetId=" + datasetId);
  }
}
