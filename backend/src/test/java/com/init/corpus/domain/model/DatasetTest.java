package com.init.corpus.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("Dataset")
class DatasetTest {

  @Test
  @DisplayName("createUploading: UPLOADING 상태의 Dataset을 생성한다")
  void createUploading_returnsDatasetWithUploadingStatus() {
    Dataset dataset = Dataset.createUploading(1L, "key", "테스트", "CRM", 99L);

    assertThat(dataset.getStatus()).isEqualTo(DatasetStatus.UPLOADING);
    assertThat(dataset.getWorkspaceId()).isEqualTo(1L);
    assertThat(dataset.getDatasetKey()).isEqualTo("key");
    assertThat(dataset.getCreatedBy()).isEqualTo(99L);
    assertThat(dataset.getPiiRedactionStatus()).isEqualTo(PiiRedactionStatus.PENDING);
  }

  @Test
  @DisplayName("markProcessing: UPLOADING → PROCESSING으로 전이하고 true를 반환한다")
  void markProcessing_fromUploading_transitionsToProcessingAndReturnsTrue() {
    Dataset dataset = Dataset.createUploading(1L, "key", "테스트", "CRM", 1L);

    boolean changed = dataset.markProcessing();

    assertThat(changed).isTrue();
    assertThat(dataset.getStatus()).isEqualTo(DatasetStatus.PROCESSING);
  }

  @Test
  @DisplayName("markProcessing: 이미 PROCESSING 상태면 전이 없이 false를 반환한다")
  void markProcessing_alreadyProcessing_returnsFalseWithoutStateChange() {
    Dataset dataset = Dataset.createUploading(1L, "key", "테스트", "CRM", 1L);
    dataset.markProcessing();

    boolean changed = dataset.markProcessing();

    assertThat(changed).isFalse();
    assertThat(dataset.getStatus()).isEqualTo(DatasetStatus.PROCESSING);
  }

  @Test
  @DisplayName("markProcessing: READY 상태면 전이 없이 false를 반환한다")
  void markProcessing_fromReady_returnsFalse() {
    Dataset dataset = Dataset.create(1L, "key", "테스트", "CRM", 1L);

    boolean changed = dataset.markProcessing();

    assertThat(changed).isFalse();
    assertThat(dataset.getStatus()).isEqualTo(DatasetStatus.READY);
  }

  @Test
  @DisplayName("markIngestionTriggerFailed: PROCESSING → ERROR로 전이하고 true를 반환한다")
  void markIngestionTriggerFailed_fromProcessing_transitionsToError() {
    Dataset dataset = Dataset.createUploading(1L, "key", "테스트", "CRM", 1L);
    dataset.markProcessing();

    boolean changed = dataset.markIngestionTriggerFailed();

    assertThat(changed).isTrue();
    assertThat(dataset.getStatus()).isEqualTo(DatasetStatus.ERROR);
  }

  @Test
  @DisplayName("markIngestionTriggerFailed: DONE 상태면 전이 없이 false를 반환한다")
  void markIngestionTriggerFailed_fromDone_returnsFalse() {
    Dataset dataset = Dataset.createUploading(1L, "key", "테스트", "CRM", 1L);
    org.springframework.test.util.ReflectionTestUtils.setField(
        dataset, "status", DatasetStatus.DONE);

    boolean changed = dataset.markIngestionTriggerFailed();

    assertThat(changed).isFalse();
    assertThat(dataset.getStatus()).isEqualTo(DatasetStatus.DONE);
  }

  @Test
  @DisplayName("updateMetaJson: null을 전달하면 NullPointerException을 던진다")
  void updateMetaJson_null_throwsNpe() {
    Dataset dataset = Dataset.createUploading(1L, "key", "테스트", "CRM", 1L);

    assertThatThrownBy(() -> dataset.updateMetaJson(null)).isInstanceOf(NullPointerException.class);
  }

  @Test
  @DisplayName("updateMetaJson: 공백 문자열을 전달하면 IllegalArgumentException을 던진다")
  void updateMetaJson_blank_throwsIllegalArgument() {
    Dataset dataset = Dataset.createUploading(1L, "key", "테스트", "CRM", 1L);

    assertThatThrownBy(() -> dataset.updateMetaJson("   "))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("blank");
  }

  @Test
  @DisplayName("updateMetaJson: 유효하지 않은 JSON을 전달하면 IllegalArgumentException을 던진다")
  void updateMetaJson_invalidJson_throwsIllegalArgument() {
    Dataset dataset = Dataset.createUploading(1L, "key", "테스트", "CRM", 1L);

    assertThatThrownBy(() -> dataset.updateMetaJson("{not-valid-json"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("not valid JSON");
  }

  @Test
  @DisplayName("updateMetaJson: 유효한 JSON을 전달하면 metaJson이 갱신된다")
  void updateMetaJson_validJson_updatesMetaJson() {
    Dataset dataset = Dataset.createUploading(1L, "key", "테스트", "CRM", 1L);

    dataset.updateMetaJson("{\"upload\":{\"objectKey\":\"pending/key\"}}");

    assertThat(dataset.getMetaJson()).contains("pending/key");
  }
}
