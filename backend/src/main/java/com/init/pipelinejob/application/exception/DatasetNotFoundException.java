package com.init.pipelinejob.application.exception;

import com.init.shared.application.exception.NotFoundException;

public class DatasetNotFoundException extends NotFoundException {

  public DatasetNotFoundException(Long datasetId, Long workspaceId) {
    super(
        "DATASET_NOT_FOUND",
        "Dataset을 찾을 수 없습니다. id=" + datasetId + ", workspaceId=" + workspaceId);
  }
}
