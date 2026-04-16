package com.init.corpus.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("DatasetRawFile")
class DatasetRawFileTest {

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
            "abc123sha256hash");

    assertThat(file.getDatasetId()).isEqualTo(1L);
    assertThat(file.getObjectKey()).isEqualTo("workspaces/1/datasets/key/uuid_test.json");
    assertThat(file.getOriginalFilename()).isEqualTo("test.json");
    assertThat(file.getContentType()).isEqualTo("application/json");
    assertThat(file.getSizeBytes()).isEqualTo(1024L);
    assertThat(file.getChecksumSha256()).isEqualTo("abc123sha256hash");
    assertThat(file.getUploadedAt()).isNotNull();
    assertThat(file.getId()).isNull();
  }
}
