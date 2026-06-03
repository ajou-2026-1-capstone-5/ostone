package com.init.corpus.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.corpus.application.exception.DatasetNotFoundException;
import com.init.corpus.application.exception.InvalidUploadStateException;
import com.init.corpus.application.exception.UnauthorizedWorkspaceAccessException;
import com.init.corpus.application.port.IngestionTriggerPort;
import com.init.corpus.application.port.RawFileStoragePort;
import com.init.corpus.application.port.RawFileStoragePort.ObjectMetadata;
import com.init.corpus.domain.model.ChecksumStatus;
import com.init.corpus.domain.model.Dataset;
import com.init.corpus.domain.model.DatasetRawFile;
import com.init.corpus.domain.model.DatasetStatus;
import com.init.corpus.domain.repository.DatasetRawFileRepository;
import com.init.corpus.domain.repository.DatasetRepository;
import com.init.corpus.domain.repository.WorkspaceMembershipRepository;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("CompleteRawFileUploadService")
class CompleteRawFileUploadServiceTest {

  @Mock private WorkspaceMembershipRepository workspaceMembershipRepository;
  @Mock private DatasetRepository datasetRepository;
  @Mock private DatasetRawFileRepository rawFileRepository;
  @Mock private RawFileStoragePort storagePort;
  @Mock private IngestionTriggerPort triggerPort;

  private final ObjectMapper objectMapper = new ObjectMapper();
  private CompleteRawFileUploadService service;

  private static final String OBJECT_KEY = "pending/workspaces/1/datasets/test-key/uuid_data.zip";
  private static final String COMPLETED_KEY =
      "completed/workspaces/1/datasets/test-key/uuid_data.zip";
  private static final long EXPECTED_SIZE = 1024L;

  @BeforeEach
  void setUp() {
    service =
        new CompleteRawFileUploadService(
            workspaceMembershipRepository,
            datasetRepository,
            rawFileRepository,
            storagePort,
            triggerPort,
            objectMapper);
  }

  private CompleteRawFileUploadCommand command() {
    return new CompleteRawFileUploadCommand(1L, 42L, 1L);
  }

  private Dataset uploadingDataset() {
    Dataset dataset = Dataset.createUploading(1L, "test-key", "테스트", "CRM", 1L);
    ReflectionTestUtils.setField(dataset, "id", 42L);
    dataset.updateMetaJson(buildMeta(EXPECTED_SIZE));
    return dataset;
  }

  private String buildMeta(long size) {
    return "{\"upload\":{\"objectKey\":\""
        + OBJECT_KEY
        + "\",\"expectedSizeBytes\":"
        + size
        + ",\"filename\":\"data.zip\",\"contentType\":\"application/zip\",\"expiresAt\":\""
        + OffsetDateTime.now().plusMinutes(15)
        + "\",\"createdBy\":1}}";
  }

  @Test
  @DisplayName("should_promote_pending_to_completed_persist_rawfile_and_trigger_with_completed_key")
  void complete_success_promotesTransitionsAndTriggers() {
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    Dataset dataset = uploadingDataset();
    given(datasetRepository.findByIdAndWorkspaceIdForUpdate(42L, 1L))
        .willReturn(Optional.of(dataset));
    given(storagePort.headObject(OBJECT_KEY))
        .willReturn(Optional.of(new ObjectMetadata(EXPECTED_SIZE, "\"etag-123\"")));
    given(datasetRepository.save(any())).willAnswer(invocation -> invocation.getArgument(0));

    CompleteRawFileUploadResult result = service.complete(command());

    assertThat(result.status()).isEqualTo(DatasetStatus.PROCESSING);
    assertThat(result.objectKey()).isEqualTo(COMPLETED_KEY);
    assertThat(result.sizeBytes()).isEqualTo(EXPECTED_SIZE);
    assertThat(dataset.getStatus()).isEqualTo(DatasetStatus.PROCESSING);

    // pending → completed 승격: copy 후 원본(pending) 삭제.
    verify(storagePort).copyObject(OBJECT_KEY, COMPLETED_KEY);
    verify(storagePort).delete(OBJECT_KEY);

    ArgumentCaptor<DatasetRawFile> rawFileCaptor = ArgumentCaptor.forClass(DatasetRawFile.class);
    verify(rawFileRepository).save(rawFileCaptor.capture());
    DatasetRawFile saved = rawFileCaptor.getValue();
    assertThat(saved.getObjectKey()).isEqualTo(COMPLETED_KEY);
    assertThat(saved.getChecksumSha256()).isNull();
    assertThat(saved.getChecksumStatus()).isEqualTo(ChecksumStatus.PENDING);
    assertThat(saved.getEtag()).isEqualTo("\"etag-123\"");

    // 트리거는 ML이 읽을 completed 키로 한 번만 호출된다.
    verify(triggerPort).trigger(1L, 42L, COMPLETED_KEY);
  }

  @Test
  @DisplayName("should_keep_processing_state_when_trigger_fails_after_commit")
  void complete_triggerFails_keepsProcessingState() {
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    Dataset dataset = uploadingDataset();
    given(datasetRepository.findByIdAndWorkspaceIdForUpdate(42L, 1L))
        .willReturn(Optional.of(dataset));
    given(storagePort.headObject(OBJECT_KEY))
        .willReturn(Optional.of(new ObjectMetadata(EXPECTED_SIZE, "\"etag-123\"")));
    given(datasetRepository.save(any())).willAnswer(invocation -> invocation.getArgument(0));
    org.mockito.BDDMockito.willThrow(new IllegalStateException("airflow down"))
        .given(triggerPort)
        .trigger(1L, 42L, COMPLETED_KEY);

    // 트리거 실패는 호출자에게 전파되지만, DB 상태 전이(PROCESSING·raw file 저장)는 이미 커밋되어 롤백되지 않는다.
    assertThatThrownBy(() -> service.complete(command()))
        .isInstanceOf(IllegalStateException.class);

    verify(rawFileRepository).save(any());
    assertThat(dataset.getStatus()).isEqualTo(DatasetStatus.PROCESSING);
  }

  @Test
  @DisplayName("should_be_idempotent_when_already_processing")
  void complete_alreadyProcessing_doesNotRetrigger() {
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    Dataset dataset = uploadingDataset();
    dataset.markProcessing();
    given(datasetRepository.findByIdAndWorkspaceIdForUpdate(42L, 1L)).willReturn(Optional.of(dataset));

    CompleteRawFileUploadResult result = service.complete(command());

    assertThat(result.status()).isEqualTo(DatasetStatus.PROCESSING);
    assertThat(result.datasetId()).isEqualTo(42L);
    verify(storagePort, never()).headObject(anyString());
    verify(rawFileRepository, never()).save(any());
    verify(triggerPort, never()).trigger(anyLong(), anyLong(), anyString());
    verify(datasetRepository, never()).save(any());
  }

  @Test
  @DisplayName("should_throw_UnauthorizedWorkspaceAccessException_when_비멤버")
  void complete_notMember_throws() {
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(false);

    assertThatThrownBy(() -> service.complete(command()))
        .isInstanceOf(UnauthorizedWorkspaceAccessException.class);

    verify(datasetRepository, never()).findByIdAndWorkspaceIdForUpdate(anyLong(), anyLong());
  }

  @Test
  @DisplayName("should_throw_DatasetNotFoundException_when_데이터셋_없음")
  void complete_datasetNotFound_throws() {
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.findByIdAndWorkspaceIdForUpdate(42L, 1L)).willReturn(Optional.empty());

    assertThatThrownBy(() -> service.complete(command()))
        .isInstanceOf(DatasetNotFoundException.class);

    verify(triggerPort, never()).trigger(anyLong(), anyLong(), anyString());
  }

  @Test
  @DisplayName("should_throw_when_object_missing_in_storage")
  void complete_objectMissing_throws() {
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.findByIdAndWorkspaceIdForUpdate(42L, 1L))
        .willReturn(Optional.of(uploadingDataset()));
    given(storagePort.headObject(OBJECT_KEY)).willReturn(Optional.empty());

    assertThatThrownBy(() -> service.complete(command()))
        .isInstanceOf(InvalidUploadStateException.class)
        .hasMessageContaining("업로드된 객체");

    verify(rawFileRepository, never()).save(any());
    verify(triggerPort, never()).trigger(anyLong(), anyLong(), anyString());
  }

  @Test
  @DisplayName("should_throw_when_object_size_mismatches_expected")
  void complete_sizeMismatch_throws() {
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.findByIdAndWorkspaceIdForUpdate(42L, 1L))
        .willReturn(Optional.of(uploadingDataset()));
    given(storagePort.headObject(OBJECT_KEY))
        .willReturn(Optional.of(new ObjectMetadata(EXPECTED_SIZE + 1, "\"etag\"")));

    assertThatThrownBy(() -> service.complete(command()))
        .isInstanceOf(InvalidUploadStateException.class)
        .hasMessageContaining("일치하지 않습니다");

    verify(rawFileRepository, never()).save(any());
    verify(triggerPort, never()).trigger(anyLong(), anyLong(), anyString());
  }

  @Test
  @DisplayName("should_throw_when_object_size_over_4GB")
  void complete_sizeOverLimit_throws() {
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    Dataset dataset = Dataset.createUploading(1L, "test-key", "테스트", "CRM", 1L);
    ReflectionTestUtils.setField(dataset, "id", 42L);
    long huge = InitRawFileUploadService.MAX_UPLOAD_BYTES + 10;
    dataset.updateMetaJson(buildMeta(huge));
    given(datasetRepository.findByIdAndWorkspaceIdForUpdate(42L, 1L)).willReturn(Optional.of(dataset));
    given(storagePort.headObject(OBJECT_KEY))
        .willReturn(
            Optional.of(
                new ObjectMetadata(InitRawFileUploadService.MAX_UPLOAD_BYTES + 1, "\"etag\"")));

    assertThatThrownBy(() -> service.complete(command()))
        .isInstanceOf(InvalidUploadStateException.class)
        .hasMessageContaining("4GB");

    verify(triggerPort, never()).trigger(anyLong(), anyLong(), anyString());
  }
}
