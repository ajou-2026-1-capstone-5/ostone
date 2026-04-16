package com.init.corpus.application;

import com.init.shared.application.exception.BadRequestException;
import java.util.Objects;

public record RawFileUploadCommand(
    Long workspaceId,
    String datasetKey,
    String name,
    String sourceType,
    Long createdBy,
    byte[] fileBytes,
    String originalFilename,
    String contentType,
    long sizeBytes) {

  public RawFileUploadCommand {
    Objects.requireNonNull(workspaceId, "workspaceId must not be null");
    Objects.requireNonNull(createdBy, "createdBy must not be null");
    Objects.requireNonNull(fileBytes, "fileBytes must not be null");
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
    if (originalFilename == null || originalFilename.isBlank()) {
      throw new BadRequestException("VALIDATION_ERROR", "originalFilename must not be blank");
    }
    if (originalFilename.length() > 255) {
      throw new BadRequestException(
          "VALIDATION_ERROR", "originalFilename must not exceed 255 characters");
    }
    if (contentType == null || contentType.isBlank()) {
      throw new BadRequestException("VALIDATION_ERROR", "contentType must not be blank");
    }
    if (contentType.length() > 100) {
      throw new BadRequestException(
          "VALIDATION_ERROR", "contentType must not exceed 100 characters");
    }
  }
}
