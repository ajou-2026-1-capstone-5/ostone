package com.init.corpus.application;

import com.init.shared.application.exception.BadRequestException;

public record CompleteRawFileUploadCommand(Long workspaceId, Long datasetId, Long createdBy) {

  public CompleteRawFileUploadCommand {
    if (workspaceId == null) {
      throw new BadRequestException("VALIDATION_ERROR", "workspaceId must not be null");
    }
    if (datasetId == null) {
      throw new BadRequestException("VALIDATION_ERROR", "datasetId must not be null");
    }
    if (createdBy == null) {
      throw new BadRequestException("VALIDATION_ERROR", "createdBy must not be null");
    }
  }
}
