package com.init.corpus.application;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.init.shared.application.exception.BadRequestException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

@DisplayName("InitRawFileUploadCommand")
class InitRawFileUploadCommandTest {

  private static final Long WS_ID = 1L;
  private static final String KEY = "test-key";
  private static final String NAME = "테스트";
  private static final String SOURCE = "CRM";
  private static final Long USER_ID = 1L;
  private static final String FILENAME = "data.zip";
  private static final String CONTENT_TYPE = "application/zip";
  private static final long SIZE = 1024L;

  @Test
  @DisplayName("workspaceId가 null이면 BadRequestException을 던진다")
  void compact_constructor_rejects_null_workspaceId() {
    assertThatThrownBy(
            () ->
                new InitRawFileUploadCommand(
                    null, KEY, NAME, SOURCE, USER_ID, FILENAME, CONTENT_TYPE, SIZE))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("workspaceId");
  }

  @Test
  @DisplayName("createdBy가 null이면 BadRequestException을 던진다")
  void compact_constructor_rejects_null_createdBy() {
    assertThatThrownBy(
            () ->
                new InitRawFileUploadCommand(
                    WS_ID, KEY, NAME, SOURCE, null, FILENAME, CONTENT_TYPE, SIZE))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("createdBy");
  }

  @Test
  @DisplayName("datasetKey가 안전한 slug이면 생성된다")
  void compact_constructor_accepts_safe_datasetKey_slug() {
    assertThatCode(
            () ->
                new InitRawFileUploadCommand(
                    WS_ID, "crm_2026-logs", NAME, SOURCE, USER_ID, FILENAME, CONTENT_TYPE, SIZE))
        .doesNotThrowAnyException();
  }

  @Test
  @DisplayName("datasetKey가 null이면 BadRequestException을 던진다")
  void compact_constructor_rejects_null_datasetKey() {
    assertThatThrownBy(
            () ->
                new InitRawFileUploadCommand(
                    WS_ID, null, NAME, SOURCE, USER_ID, FILENAME, CONTENT_TYPE, SIZE))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("datasetKey");
  }

  @ParameterizedTest
  @ValueSource(strings = {"../dataset", "foo/bar", "dataset.key", "-dataset", "dataset\nkey"})
  @DisplayName("datasetKey가 object key 세그먼트로 안전하지 않으면 BadRequestException을 던진다")
  void compact_constructor_rejects_unsafe_datasetKey_segment(String unsafeKey) {
    assertThatThrownBy(
            () ->
                new InitRawFileUploadCommand(
                    WS_ID, unsafeKey, NAME, SOURCE, USER_ID, FILENAME, CONTENT_TYPE, SIZE))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("datasetKey");
  }

  @Test
  @DisplayName("datasetKey가 100자 초과면 BadRequestException을 던진다")
  void compact_constructor_rejects_overlong_datasetKey() {
    String longKey = "a".repeat(101);
    assertThatThrownBy(
            () ->
                new InitRawFileUploadCommand(
                    WS_ID, longKey, NAME, SOURCE, USER_ID, FILENAME, CONTENT_TYPE, SIZE))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("datasetKey");
  }

  @Test
  @DisplayName("name이 null이면 BadRequestException을 던진다")
  void compact_constructor_rejects_null_name() {
    assertThatThrownBy(
            () ->
                new InitRawFileUploadCommand(
                    WS_ID, KEY, null, SOURCE, USER_ID, FILENAME, CONTENT_TYPE, SIZE))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("name");
  }

  @Test
  @DisplayName("name이 255자 초과면 BadRequestException을 던진다")
  void compact_constructor_rejects_overlong_name() {
    String longName = "n".repeat(256);
    assertThatThrownBy(
            () ->
                new InitRawFileUploadCommand(
                    WS_ID, KEY, longName, SOURCE, USER_ID, FILENAME, CONTENT_TYPE, SIZE))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("name");
  }

  @Test
  @DisplayName("sourceType이 null이면 BadRequestException을 던진다")
  void compact_constructor_rejects_null_sourceType() {
    assertThatThrownBy(
            () ->
                new InitRawFileUploadCommand(
                    WS_ID, KEY, NAME, null, USER_ID, FILENAME, CONTENT_TYPE, SIZE))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("sourceType");
  }

  @Test
  @DisplayName("sourceType이 50자 초과면 BadRequestException을 던진다")
  void compact_constructor_rejects_overlong_sourceType() {
    String longSrc = "s".repeat(51);
    assertThatThrownBy(
            () ->
                new InitRawFileUploadCommand(
                    WS_ID, KEY, NAME, longSrc, USER_ID, FILENAME, CONTENT_TYPE, SIZE))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("sourceType");
  }

  @Test
  @DisplayName("filename이 null이면 BadRequestException을 던진다")
  void compact_constructor_rejects_null_filename() {
    assertThatThrownBy(
            () ->
                new InitRawFileUploadCommand(
                    WS_ID, KEY, NAME, SOURCE, USER_ID, null, CONTENT_TYPE, SIZE))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("filename");
  }

  @Test
  @DisplayName("filename이 255자 초과면 BadRequestException을 던진다")
  void compact_constructor_rejects_overlong_filename() {
    String longFilename = "f".repeat(256);
    assertThatThrownBy(
            () ->
                new InitRawFileUploadCommand(
                    WS_ID, KEY, NAME, SOURCE, USER_ID, longFilename, CONTENT_TYPE, SIZE))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("filename");
  }

  @Test
  @DisplayName("contentType이 null이면 BadRequestException을 던진다")
  void compact_constructor_rejects_null_contentType() {
    assertThatThrownBy(
            () ->
                new InitRawFileUploadCommand(
                    WS_ID, KEY, NAME, SOURCE, USER_ID, FILENAME, null, SIZE))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("contentType");
  }

  @Test
  @DisplayName("contentType이 100자 초과면 BadRequestException을 던진다")
  void compact_constructor_rejects_overlong_contentType() {
    String longCt = "c".repeat(101);
    assertThatThrownBy(
            () ->
                new InitRawFileUploadCommand(
                    WS_ID, KEY, NAME, SOURCE, USER_ID, FILENAME, longCt, SIZE))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("contentType");
  }

  @Test
  @DisplayName("sizeBytes가 0 이하면 BadRequestException을 던진다")
  void compact_constructor_rejects_non_positive_sizeBytes() {
    assertThatThrownBy(
            () ->
                new InitRawFileUploadCommand(
                    WS_ID, KEY, NAME, SOURCE, USER_ID, FILENAME, CONTENT_TYPE, 0L))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("sizeBytes");
  }
}
