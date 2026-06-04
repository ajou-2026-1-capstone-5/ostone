package com.init.corpus.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("DatasetRawFile")
class DatasetRawFileTest {

  private static final String VALID_SHA256 = "a".repeat(64);

  @Test
  @DisplayName("should_create_with_all_required_fields")
  void create_withValidFields_returnsEntity() {
    DatasetRawFile file =
        DatasetRawFile.create(
            1L,
            "workspaces/1/datasets/key/uuid_test.json",
            "test.json",
            "application/json",
            1024L,
            VALID_SHA256);

    assertThat(file.getDatasetId()).isEqualTo(1L);
    assertThat(file.getObjectKey()).isEqualTo("workspaces/1/datasets/key/uuid_test.json");
    assertThat(file.getOriginalFilename()).isEqualTo("test.json");
    assertThat(file.getContentType()).isEqualTo("application/json");
    assertThat(file.getSizeBytes()).isEqualTo(1024L);
    assertThat(file.getChecksumSha256()).isEqualTo(VALID_SHA256);
    assertThat(file.getUploadedAt()).isNotNull();
    assertThat(file.getId()).isNull();
  }

  // ── create 검증 ─────────────────────────────────────────────────────────

  @Test
  @DisplayName("create: datasetId가 음수면 예외를 던진다")
  void create_negativeDatasetId_throws() {
    assertThatThrownBy(
            () ->
                DatasetRawFile.create(
                    -1L, "key", "file.json", "application/json", 1L, VALID_SHA256))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("datasetId");
  }

  @Test
  @DisplayName("create: objectKey가 공백이면 예외를 던진다")
  void create_blankObjectKey_throws() {
    assertThatThrownBy(
            () ->
                DatasetRawFile.create(1L, "  ", "file.json", "application/json", 1L, VALID_SHA256))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("objectKey");
  }

  @Test
  @DisplayName("create: originalFilename이 공백이면 예외를 던진다")
  void create_blankOriginalFilename_throws() {
    assertThatThrownBy(
            () -> DatasetRawFile.create(1L, "key", "  ", "application/json", 1L, VALID_SHA256))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("originalFilename");
  }

  @Test
  @DisplayName("create: contentType이 공백이면 예외를 던진다")
  void create_blankContentType_throws() {
    assertThatThrownBy(() -> DatasetRawFile.create(1L, "key", "file.json", "  ", 1L, VALID_SHA256))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("contentType");
  }

  @Test
  @DisplayName("create: checksumSha256가 64자 hex가 아니면 예외를 던진다")
  void create_invalidChecksumSha256_throws() {
    assertThatThrownBy(
            () -> DatasetRawFile.create(1L, "key", "file.json", "application/json", 1L, "short"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("checksumSha256");
  }

  @Test
  @DisplayName("create: sizeBytes가 음수면 예외를 던진다")
  void create_negativeSizeBytes_throws() {
    assertThatThrownBy(
            () ->
                DatasetRawFile.create(
                    1L, "key", "file.json", "application/json", -1L, VALID_SHA256))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("sizeBytes");
  }

  // ── createPending ────────────────────────────────────────────────────────

  @Test
  @DisplayName("createPending: 유효한 입력으로 PENDING 상태의 DatasetRawFile을 생성한다")
  void createPending_withValidFields_returnsEntityWithPendingStatus() {
    DatasetRawFile file =
        DatasetRawFile.createPending(
            1L,
            "pending/workspaces/1/datasets/key/uuid_data.zip",
            "data.zip",
            "application/zip",
            2048L,
            "\"etag-123\"");

    assertThat(file.getDatasetId()).isEqualTo(1L);
    assertThat(file.getObjectKey()).isEqualTo("pending/workspaces/1/datasets/key/uuid_data.zip");
    assertThat(file.getOriginalFilename()).isEqualTo("data.zip");
    assertThat(file.getContentType()).isEqualTo("application/zip");
    assertThat(file.getSizeBytes()).isEqualTo(2048L);
    assertThat(file.getChecksumSha256()).isNull();
    assertThat(file.getChecksumStatus()).isEqualTo(ChecksumStatus.PENDING);
    assertThat(file.getEtag()).isEqualTo("\"etag-123\"");
    assertThat(file.getUploadedAt()).isNotNull();
  }

  @Test
  @DisplayName("createPending: datasetId가 음수면 예외를 던진다")
  void createPending_negativeDatasetId_throws() {
    assertThatThrownBy(
            () ->
                DatasetRawFile.createPending(
                    -1L, "key", "data.zip", "application/zip", 1L, "\"etag\""))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("datasetId");
  }

  @Test
  @DisplayName("createPending: objectKey가 공백이면 예외를 던진다")
  void createPending_blankObjectKey_throws() {
    assertThatThrownBy(
            () ->
                DatasetRawFile.createPending(
                    1L, "  ", "data.zip", "application/zip", 1L, "\"etag\""))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("objectKey");
  }

  @Test
  @DisplayName("createPending: originalFilename이 공백이면 예외를 던진다")
  void createPending_blankOriginalFilename_throws() {
    assertThatThrownBy(
            () -> DatasetRawFile.createPending(1L, "key", "  ", "application/zip", 1L, "\"etag\""))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("originalFilename");
  }

  @Test
  @DisplayName("createPending: contentType이 공백이면 예외를 던진다")
  void createPending_blankContentType_throws() {
    assertThatThrownBy(
            () -> DatasetRawFile.createPending(1L, "key", "data.zip", "  ", 1L, "\"etag\""))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("contentType");
  }

  @Test
  @DisplayName("createPending: sizeBytes가 음수면 예외를 던진다")
  void createPending_negativeSizeBytes_throws() {
    assertThatThrownBy(
            () ->
                DatasetRawFile.createPending(
                    1L, "key", "data.zip", "application/zip", -1L, "\"etag\""))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("sizeBytes");
  }

  @Test
  @DisplayName("createPending: etag가 null이면 예외를 던진다")
  void createPending_nullEtag_throws() {
    assertThatThrownBy(
            () -> DatasetRawFile.createPending(1L, "key", "data.zip", "application/zip", 1L, null))
        .isInstanceOf(NullPointerException.class)
        .hasMessageContaining("etag");
  }

  @Test
  @DisplayName("createPending: etag가 공백이면 예외를 던진다")
  void createPending_blankEtag_throws() {
    assertThatThrownBy(
            () -> DatasetRawFile.createPending(1L, "key", "data.zip", "application/zip", 1L, "  "))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("etag");
  }
}
