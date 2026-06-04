package com.init.corpus.application;

import com.init.shared.application.exception.BadRequestException;

public record InitRawFileUploadCommand(
    Long workspaceId,
    String datasetKey,
    String name,
    String sourceType,
    Long createdBy,
    String filename,
    String contentType,
    long sizeBytes) {

  public InitRawFileUploadCommand {
    if (workspaceId == null) {
      throw new BadRequestException("VALIDATION_ERROR", "workspaceId must not be null");
    }
    if (createdBy == null) {
      throw new BadRequestException("VALIDATION_ERROR", "createdBy must not be null");
    }
    if (datasetKey == null || datasetKey.isBlank()) {
      throw new BadRequestException("VALIDATION_ERROR", "datasetKey must not be blank");
    }
    if (datasetKey.length() > 100) {
      throw new BadRequestException(
          "VALIDATION_ERROR", "datasetKey must not exceed 100 characters");
    }
    if (name == null || name.isBlank()) {
      throw new BadRequestException("VALIDATION_ERROR", "name must not be blank");
    }
    if (name.length() > 255) {
      throw new BadRequestException("VALIDATION_ERROR", "name must not exceed 255 characters");
    }
    if (sourceType == null || sourceType.isBlank()) {
      throw new BadRequestException("VALIDATION_ERROR", "sourceType must not be blank");
    }
    if (sourceType.length() > 50) {
      throw new BadRequestException("VALIDATION_ERROR", "sourceType must not exceed 50 characters");
    }
    if (filename == null || filename.isBlank()) {
      throw new BadRequestException("VALIDATION_ERROR", "filename must not be blank");
    }
    if (filename.length() > 255) {
      throw new BadRequestException("VALIDATION_ERROR", "filename must not exceed 255 characters");
    }
    if (contentType == null || contentType.isBlank()) {
      throw new BadRequestException("VALIDATION_ERROR", "contentType must not be blank");
    }
    if (contentType.length() > 100) {
      throw new BadRequestException(
          "VALIDATION_ERROR", "contentType must not exceed 100 characters");
    }
    if (sizeBytes <= 0) {
      throw new BadRequestException("VALIDATION_ERROR", "sizeBytes must be positive");
    }
  }
}
