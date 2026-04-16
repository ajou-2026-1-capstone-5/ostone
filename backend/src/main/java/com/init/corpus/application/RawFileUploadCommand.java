package com.init.corpus.application;

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
      throw new IllegalArgumentException("datasetKey must not be blank");
    }
    if (datasetKey.length() > 100) {
      throw new IllegalArgumentException("datasetKey must not exceed 100 characters");
    }
    if (name == null || name.isBlank()) {
      throw new IllegalArgumentException("name must not be blank");
    }
    if (name.length() > 255) {
      throw new IllegalArgumentException("name must not exceed 255 characters");
    }
    if (sourceType == null || sourceType.isBlank()) {
      throw new IllegalArgumentException("sourceType must not be blank");
    }
    if (sourceType.length() > 50) {
      throw new IllegalArgumentException("sourceType must not exceed 50 characters");
    }
    if (originalFilename == null || originalFilename.isBlank()) {
      throw new IllegalArgumentException("originalFilename must not be blank");
    }
    if (originalFilename.length() > 255) {
      throw new IllegalArgumentException("originalFilename must not exceed 255 characters");
    }
    if (contentType == null || contentType.isBlank()) {
      throw new IllegalArgumentException("contentType must not be blank");
    }
    if (contentType.length() > 100) {
      throw new IllegalArgumentException("contentType must not exceed 100 characters");
    }
  }
}
