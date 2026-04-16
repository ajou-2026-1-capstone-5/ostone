package com.init.corpus.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "dataset_raw_file", schema = "corpus")
public class DatasetRawFile {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "dataset_id", nullable = false)
  private Long datasetId;

  @Column(name = "object_key", nullable = false, length = 1024)
  private String objectKey;

  @Column(name = "original_filename", nullable = false, length = 255)
  private String originalFilename;

  @Column(name = "content_type", nullable = false, length = 100)
  private String contentType;

  @Column(name = "size_bytes", nullable = false)
  private Long sizeBytes;

  @Column(name = "checksum_sha256", nullable = false, length = 64)
  private String checksumSha256;

  @Column(name = "uploaded_at", nullable = false)
  private Instant uploadedAt;

  protected DatasetRawFile() {}

  public static DatasetRawFile create(
      Long datasetId,
      String objectKey,
      String originalFilename,
      String contentType,
      Long sizeBytes,
      String checksumSha256) {
    Objects.requireNonNull(datasetId, "datasetId must not be null");
    Objects.requireNonNull(objectKey, "objectKey must not be null");
    Objects.requireNonNull(originalFilename, "originalFilename must not be null");
    Objects.requireNonNull(contentType, "contentType must not be null");
    Objects.requireNonNull(checksumSha256, "checksumSha256 must not be null");
    Objects.requireNonNull(sizeBytes, "sizeBytes must not be null");
    if (datasetId < 0) {
      throw new IllegalArgumentException("datasetId must be >= 0");
    }
    if (objectKey.isBlank()) {
      throw new IllegalArgumentException("objectKey must not be blank");
    }
    if (originalFilename.isBlank()) {
      throw new IllegalArgumentException("originalFilename must not be blank");
    }
    if (contentType.isBlank()) {
      throw new IllegalArgumentException("contentType must not be blank");
    }
    if (!checksumSha256.matches("[0-9a-fA-F]{64}")) {
      throw new IllegalArgumentException(
          "checksumSha256 must be a 64-character hexadecimal string");
    }
    if (sizeBytes < 0) {
      throw new IllegalArgumentException("sizeBytes must be >= 0");
    }
    DatasetRawFile file = new DatasetRawFile();
    file.datasetId = datasetId;
    file.objectKey = objectKey;
    file.originalFilename = originalFilename;
    file.contentType = contentType;
    file.sizeBytes = sizeBytes;
    file.checksumSha256 = checksumSha256;
    file.uploadedAt = Instant.now();
    return file;
  }

  public Long getId() {
    return id;
  }

  public Long getDatasetId() {
    return datasetId;
  }

  public String getObjectKey() {
    return objectKey;
  }

  public String getOriginalFilename() {
    return originalFilename;
  }

  public String getContentType() {
    return contentType;
  }

  public Long getSizeBytes() {
    return sizeBytes;
  }

  public String getChecksumSha256() {
    return checksumSha256;
  }

  public Instant getUploadedAt() {
    return uploadedAt;
  }
}
