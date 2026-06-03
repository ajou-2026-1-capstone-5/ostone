package com.init.corpus.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

  @Column(name = "checksum_sha256", length = 64)
  private String checksumSha256;

  @Enumerated(EnumType.STRING)
  @Column(name = "checksum_status", nullable = false, length = 20)
  private ChecksumStatus checksumStatus;

  @Column(name = "etag", length = 255)
  private String etag;

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
    file.checksumStatus = ChecksumStatus.VERIFIED;
    file.uploadedAt = Instant.now();
    return file;
  }

  /**
   * presigned 직접 업로드 흐름용 팩토리. 백엔드가 파일 바이트를 받지 않아 업로드 시점에 체크섬을 계산할 수 없으므로 checksum은 비워 두고
   * {@code checksumStatus=PENDING}으로 둔다. 현재 presigned 경로에서 {@code PENDING}은 정상 종착 상태다: SHA-256 무결성
   * 검증은 아직 구현되지 않은 후속 과제이며, 그 전까지 {@code PENDING}→{@code VERIFIED} 전이는 일어나지 않는다. 그동안에는 S3 HEAD
   * 응답에서 얻은 etag로 객체 무결성을 추적한다.
   */
  public static DatasetRawFile createPending(
      Long datasetId,
      String objectKey,
      String originalFilename,
      String contentType,
      Long sizeBytes,
      String etag) {
    Objects.requireNonNull(datasetId, "datasetId must not be null");
    Objects.requireNonNull(objectKey, "objectKey must not be null");
    Objects.requireNonNull(originalFilename, "originalFilename must not be null");
    Objects.requireNonNull(contentType, "contentType must not be null");
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
    if (sizeBytes < 0) {
      throw new IllegalArgumentException("sizeBytes must be >= 0");
    }
    DatasetRawFile file = new DatasetRawFile();
    file.datasetId = datasetId;
    file.objectKey = objectKey;
    file.originalFilename = originalFilename;
    file.contentType = contentType;
    file.sizeBytes = sizeBytes;
    file.checksumSha256 = null;
    file.checksumStatus = ChecksumStatus.PENDING;
    file.etag = etag;
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

  public ChecksumStatus getChecksumStatus() {
    return checksumStatus;
  }

  public String getEtag() {
    return etag;
  }

  public Instant getUploadedAt() {
    return uploadedAt;
  }
}
