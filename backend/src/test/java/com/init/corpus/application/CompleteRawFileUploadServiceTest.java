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
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

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
    return buildMeta(size, OffsetDateTime.now().plusMinutes(15), 1L);
  }

  private String buildMeta(long size, OffsetDateTime expiresAt, long createdBy) {
    return "{\"upload\":{\"objectKey\":\""
        + OBJECT_KEY
        + "\",\"expectedSizeBytes\":"
        + size
        + ",\"filename\":\"data.zip\",\"contentType\":\"application/zip\",\"expiresAt\":\""
        + expiresAt
        + "\",\"createdBy\":"
        + createdBy
        + "}}";
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

    TransactionSynchronizationManager.initSynchronization();
    CompleteRawFileUploadResult result;
    try {
      result = service.complete(command());

      verify(storagePort).copyObject(OBJECT_KEY, COMPLETED_KEY);
      verify(storagePort, never()).delete(anyString());
      verify(triggerPort, never()).trigger(anyLong(), anyLong(), anyString());

      List<TransactionSynchronization> synchronizations =
          List.copyOf(TransactionSynchronizationManager.getSynchronizations());
      assertThat(synchronizations).hasSize(2);
      synchronizations.forEach(TransactionSynchronization::afterCommit);
      synchronizations.forEach(
          synchronization ->
              synchronization.afterCompletion(TransactionSynchronization.STATUS_COMMITTED));
    } finally {
      TransactionSynchronizationManager.clearSynchronization();
    }

    assertThat(result.status()).isEqualTo(DatasetStatus.PROCESSING);
    assertThat(result.objectKey()).isEqualTo(COMPLETED_KEY);
    assertThat(result.sizeBytes()).isEqualTo(EXPECTED_SIZE);
    assertThat(dataset.getStatus()).isEqualTo(DatasetStatus.PROCESSING);

    // pending 원본 삭제와 트리거는 커밋 이후에 수행된다.
    verify(storagePort).delete(OBJECT_KEY);
    verify(storagePort, never()).delete(COMPLETED_KEY);

    ArgumentCaptor<DatasetRawFile> rawFileCaptor = ArgumentCaptor.forClass(DatasetRawFile.class);
    verify(rawFileRepository).save(rawFileCaptor.capture());
    DatasetRawFile saved = rawFileCaptor.getValue();
    assertThat(saved.getObjectKey()).isEqualTo(COMPLETED_KEY);
    assertThat(saved.getChecksumSha256()).isNull();
    assertThat(saved.getChecksumStatus()).isEqualTo(ChecksumStatus.PENDING);
    assertThat(saved.getEtag()).isEqualTo("\"etag-123\"");

    verify(triggerPort).trigger(1L, 42L, COMPLETED_KEY);
  }

  @Test
  @DisplayName("should_not_persist_or_trigger_when_storage_promotion_fails")
  void complete_copyFails_doesNotPersistOrTrigger() {
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    Dataset dataset = uploadingDataset();
    given(datasetRepository.findByIdAndWorkspaceIdForUpdate(42L, 1L))
        .willReturn(Optional.of(dataset));
    given(storagePort.headObject(OBJECT_KEY))
        .willReturn(Optional.of(new ObjectMetadata(EXPECTED_SIZE, "\"etag-123\"")));
    org.mockito.BDDMockito.willThrow(new IllegalStateException("copy failed"))
        .given(storagePort)
        .copyObject(OBJECT_KEY, COMPLETED_KEY);

    assertThatThrownBy(() -> service.complete(command())).isInstanceOf(IllegalStateException.class);

    assertThat(dataset.getStatus()).isEqualTo(DatasetStatus.UPLOADING);
    verify(rawFileRepository, never()).save(any());
    verify(datasetRepository, never()).save(any());
    verify(storagePort, never()).delete(anyString());
    verify(triggerPort, never()).trigger(anyLong(), anyLong(), anyString());
  }

  @Test
  @DisplayName("should_delete_completed_object_when_db_save_rolls_back_after_promotion")
  void complete_dbSaveFails_deletesCompletedObjectOnRollback() {
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    Dataset dataset = uploadingDataset();
    given(datasetRepository.findByIdAndWorkspaceIdForUpdate(42L, 1L))
        .willReturn(Optional.of(dataset));
    given(storagePort.headObject(OBJECT_KEY))
        .willReturn(Optional.of(new ObjectMetadata(EXPECTED_SIZE, "\"etag-123\"")));
    org.mockito.BDDMockito.willThrow(new IllegalStateException("db down"))
        .given(rawFileRepository)
        .save(any());

    TransactionSynchronizationManager.initSynchronization();
    try {
      assertThatThrownBy(() -> service.complete(command()))
          .isInstanceOf(IllegalStateException.class)
          .hasMessageContaining("db down");

      List<TransactionSynchronization> synchronizations =
          List.copyOf(TransactionSynchronizationManager.getSynchronizations());
      assertThat(synchronizations).hasSize(1);
      synchronizations.forEach(
          synchronization ->
              synchronization.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));
    } finally {
      TransactionSynchronizationManager.clearSynchronization();
    }

    verify(storagePort).copyObject(OBJECT_KEY, COMPLETED_KEY);
    verify(storagePort).delete(COMPLETED_KEY);
    verify(storagePort, never()).delete(OBJECT_KEY);
    verify(datasetRepository, never()).save(any());
    verify(triggerPort, never()).trigger(anyLong(), anyLong(), anyString());
  }

  @Test
  @DisplayName("should_delete_completed_object_when_transaction_completion_is_unknown")
  void complete_transactionUnknown_deletesCompletedObject() {
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    Dataset dataset = uploadingDataset();
    given(datasetRepository.findByIdAndWorkspaceIdForUpdate(42L, 1L))
        .willReturn(Optional.of(dataset));
    given(storagePort.headObject(OBJECT_KEY))
        .willReturn(Optional.of(new ObjectMetadata(EXPECTED_SIZE, "\"etag-123\"")));
    given(datasetRepository.save(any())).willAnswer(invocation -> invocation.getArgument(0));

    TransactionSynchronizationManager.initSynchronization();
    try {
      service.complete(command());

      List<TransactionSynchronization> synchronizations =
          List.copyOf(TransactionSynchronizationManager.getSynchronizations());
      assertThat(synchronizations).hasSize(2);
      synchronizations.forEach(
          synchronization ->
              synchronization.afterCompletion(TransactionSynchronization.STATUS_UNKNOWN));
    } finally {
      TransactionSynchronizationManager.clearSynchronization();
    }

    verify(storagePort).delete(COMPLETED_KEY);
    verify(storagePort, never()).delete(OBJECT_KEY);
    verify(triggerPort, never()).trigger(anyLong(), anyLong(), anyString());
  }

  @Test
  @DisplayName("should_propagate_afterCommit_trigger_failure_after_processing_transition")
  void complete_triggerFails_propagatesAfterCommitFailure() {
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

    TransactionSynchronizationManager.initSynchronization();
    try {
      service.complete(command());

      verify(triggerPort, never()).trigger(anyLong(), anyLong(), anyString());
      List<TransactionSynchronization> synchronizations =
          List.copyOf(TransactionSynchronizationManager.getSynchronizations());

      // 트리거 실패는 afterCommit 단계에서 전파되며, DB 상태 전이는 이미 완료된 상태다.
      assertThatThrownBy(() -> synchronizations.forEach(TransactionSynchronization::afterCommit))
          .isInstanceOf(IllegalStateException.class);
    } finally {
      TransactionSynchronizationManager.clearSynchronization();
    }

    verify(rawFileRepository).save(any());
    assertThat(dataset.getStatus()).isEqualTo(DatasetStatus.PROCESSING);
  }

  @Test
  @DisplayName("should_be_idempotent_when_already_processing")
  void complete_alreadyProcessing_doesNotRetrigger() {
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    Dataset dataset = uploadingDataset();
    dataset.markProcessing();
    given(datasetRepository.findByIdAndWorkspaceIdForUpdate(42L, 1L))
        .willReturn(Optional.of(dataset));

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
  @DisplayName("should_throw_when_upload_session_expired")
  void complete_expiredUploadSession_throws() {
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    Dataset dataset = uploadingDataset();
    dataset.updateMetaJson(buildMeta(EXPECTED_SIZE, OffsetDateTime.now().minusMinutes(1), 1L));
    given(datasetRepository.findByIdAndWorkspaceIdForUpdate(42L, 1L))
        .willReturn(Optional.of(dataset));

    assertThatThrownBy(() -> service.complete(command()))
        .isInstanceOf(InvalidUploadStateException.class)
        .hasMessageContaining("만료");

    verify(storagePort, never()).headObject(anyString());
    verify(storagePort, never()).copyObject(anyString(), anyString());
    verify(rawFileRepository, never()).save(any());
    verify(datasetRepository, never()).save(any());
    verify(triggerPort, never()).trigger(anyLong(), anyLong(), anyString());
  }

  @Test
  @DisplayName("should_throw_when_upload_session_expiresAt_missing")
  void complete_missingExpiresAt_throws() {
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    Dataset dataset = uploadingDataset();
    dataset.updateMetaJson(
        "{\"upload\":{\"objectKey\":\""
            + OBJECT_KEY
            + "\",\"expectedSizeBytes\":"
            + EXPECTED_SIZE
            + ",\"filename\":\"data.zip\",\"contentType\":\"application/zip\",\"createdBy\":1}}");
    given(datasetRepository.findByIdAndWorkspaceIdForUpdate(42L, 1L))
        .willReturn(Optional.of(dataset));

    assertThatThrownBy(() -> service.complete(command()))
        .isInstanceOf(InvalidUploadStateException.class)
        .hasMessageContaining("expiresAt");

    verify(storagePort, never()).headObject(anyString());
    verify(rawFileRepository, never()).save(any());
    verify(triggerPort, never()).trigger(anyLong(), anyLong(), anyString());
  }

  @Test
  @DisplayName("should_throw_when_upload_session_expiresAt_malformed")
  void complete_malformedExpiresAt_throws() {
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    Dataset dataset = uploadingDataset();
    dataset.updateMetaJson(
        "{\"upload\":{\"objectKey\":\""
            + OBJECT_KEY
            + "\",\"expectedSizeBytes\":"
            + EXPECTED_SIZE
            + ",\"filename\":\"data.zip\",\"contentType\":\"application/zip\",\"expiresAt\":\"not-a-date\",\"createdBy\":1}}");
    given(datasetRepository.findByIdAndWorkspaceIdForUpdate(42L, 1L))
        .willReturn(Optional.of(dataset));

    assertThatThrownBy(() -> service.complete(command()))
        .isInstanceOf(InvalidUploadStateException.class)
        .hasMessageContaining("expiresAt 형식");

    verify(storagePort, never()).headObject(anyString());
    verify(rawFileRepository, never()).save(any());
    verify(triggerPort, never()).trigger(anyLong(), anyLong(), anyString());
  }

  @Test
  @DisplayName("should_throw_when_upload_session_createdBy_missing")
  void complete_missingCreatedBy_throws() {
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    Dataset dataset = uploadingDataset();
    dataset.updateMetaJson(
        "{\"upload\":{\"objectKey\":\""
            + OBJECT_KEY
            + "\",\"expectedSizeBytes\":"
            + EXPECTED_SIZE
            + ",\"filename\":\"data.zip\",\"contentType\":\"application/zip\",\"expiresAt\":\""
            + OffsetDateTime.now().plusMinutes(15)
            + "\"}}");
    given(datasetRepository.findByIdAndWorkspaceIdForUpdate(42L, 1L))
        .willReturn(Optional.of(dataset));

    assertThatThrownBy(() -> service.complete(command()))
        .isInstanceOf(InvalidUploadStateException.class)
        .hasMessageContaining("createdBy");

    verify(storagePort, never()).headObject(anyString());
    verify(rawFileRepository, never()).save(any());
    verify(triggerPort, never()).trigger(anyLong(), anyLong(), anyString());
  }

  @Test
  @DisplayName("should_throw_when_upload_session_createdBy_mismatches_request_user")
  void complete_createdByMismatch_throws() {
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 2L)).willReturn(true);
    Dataset dataset = uploadingDataset();
    given(datasetRepository.findByIdAndWorkspaceIdForUpdate(42L, 1L))
        .willReturn(Optional.of(dataset));

    assertThatThrownBy(() -> service.complete(new CompleteRawFileUploadCommand(1L, 42L, 2L)))
        .isInstanceOf(InvalidUploadStateException.class)
        .hasMessageContaining("생성자");

    verify(storagePort, never()).headObject(anyString());
    verify(storagePort, never()).copyObject(anyString(), anyString());
    verify(rawFileRepository, never()).save(any());
    verify(datasetRepository, never()).save(any());
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
    given(datasetRepository.findByIdAndWorkspaceIdForUpdate(42L, 1L))
        .willReturn(Optional.of(dataset));
    given(storagePort.headObject(OBJECT_KEY))
        .willReturn(
            Optional.of(
                new ObjectMetadata(InitRawFileUploadService.MAX_UPLOAD_BYTES + 1, "\"etag\"")));

    assertThatThrownBy(() -> service.complete(command()))
        .isInstanceOf(InvalidUploadStateException.class)
        .hasMessageContaining("4GB");

    verify(triggerPort, never()).trigger(anyLong(), anyLong(), anyString());
  }

  @Test
  @DisplayName("should_throw_when_uploading_object_key_has_no_pending_prefix")
  void complete_uploadingObjectKeyWithoutPendingPrefix_throws() {
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    Dataset dataset = Dataset.createUploading(1L, "test-key", "테스트", "CRM", 1L);
    ReflectionTestUtils.setField(dataset, "id", 42L);
    dataset.updateMetaJson(
        "{\"upload\":{\"objectKey\":\"direct/key.zip\",\"expectedSizeBytes\":"
            + EXPECTED_SIZE
            + ",\"filename\":\"data.zip\",\"contentType\":\"application/zip\",\"expiresAt\":\""
            + OffsetDateTime.now().plusMinutes(15)
            + "\",\"createdBy\":1}}");
    given(datasetRepository.findByIdAndWorkspaceIdForUpdate(42L, 1L))
        .willReturn(Optional.of(dataset));
    given(storagePort.headObject("direct/key.zip"))
        .willReturn(Optional.of(new ObjectMetadata(EXPECTED_SIZE, "\"etag\"")));

    assertThatThrownBy(() -> service.complete(command()))
        .isInstanceOf(InvalidUploadStateException.class)
        .hasMessageContaining("pending/");

    verify(storagePort, never()).copyObject(anyString(), anyString());
    verify(storagePort, never()).delete(anyString());
    verify(rawFileRepository, never()).save(any());
    verify(triggerPort, never()).trigger(anyLong(), anyLong(), anyString());
  }

  @Test
  @DisplayName("should_throw_when_upload_field_missing_in_meta")
  void complete_noUploadFieldInMeta_throws() {
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    Dataset dataset = Dataset.createUploading(1L, "test-key", "테스트", "CRM", 1L);
    ReflectionTestUtils.setField(dataset, "id", 42L);
    dataset.updateMetaJson("{\"other\":\"value\"}");
    given(datasetRepository.findByIdAndWorkspaceIdForUpdate(42L, 1L))
        .willReturn(Optional.of(dataset));

    assertThatThrownBy(() -> service.complete(command()))
        .isInstanceOf(InvalidUploadStateException.class)
        .hasMessageContaining("presigned 업로드 세션 정보");

    verify(storagePort, never()).headObject(anyString());
  }

  @Test
  @DisplayName("should_throw_when_objectKey_missing_in_upload_session")
  void complete_objectKeyMissingInSession_throws() {
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    Dataset dataset = Dataset.createUploading(1L, "test-key", "테스트", "CRM", 1L);
    ReflectionTestUtils.setField(dataset, "id", 42L);
    dataset.updateMetaJson("{\"upload\":{\"expectedSizeBytes\":1024,\"filename\":\"d.zip\"}}");
    given(datasetRepository.findByIdAndWorkspaceIdForUpdate(42L, 1L))
        .willReturn(Optional.of(dataset));

    assertThatThrownBy(() -> service.complete(command()))
        .isInstanceOf(InvalidUploadStateException.class)
        .hasMessageContaining("objectKey");

    verify(storagePort, never()).headObject(anyString());
  }

  @Test
  @DisplayName("should_throw_when_expectedSizeBytes_missing_in_upload_session")
  void complete_expectedSizeBytesMissing_throws() {
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    Dataset dataset = Dataset.createUploading(1L, "test-key", "테스트", "CRM", 1L);
    ReflectionTestUtils.setField(dataset, "id", 42L);
    dataset.updateMetaJson(
        "{\"upload\":{\"objectKey\":\"" + OBJECT_KEY + "\",\"filename\":\"d.zip\"}}");
    given(datasetRepository.findByIdAndWorkspaceIdForUpdate(42L, 1L))
        .willReturn(Optional.of(dataset));

    assertThatThrownBy(() -> service.complete(command()))
        .isInstanceOf(InvalidUploadStateException.class)
        .hasMessageContaining("expectedSizeBytes");

    verify(storagePort, never()).headObject(anyString());
  }

  @Test
  @DisplayName("should_use_default_filename_and_contentType_when_missing_in_session")
  void complete_missingFilenameAndContentType_usesDefaults() {
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    Dataset dataset = Dataset.createUploading(1L, "test-key", "테스트", "CRM", 1L);
    ReflectionTestUtils.setField(dataset, "id", 42L);
    // filename, contentType 필드 없음
    dataset.updateMetaJson(
        "{\"upload\":{\"objectKey\":\""
            + OBJECT_KEY
            + "\",\"expectedSizeBytes\":"
            + EXPECTED_SIZE
            + ",\"expiresAt\":\""
            + OffsetDateTime.now().plusMinutes(15)
            + "\",\"createdBy\":1}}");
    given(datasetRepository.findByIdAndWorkspaceIdForUpdate(42L, 1L))
        .willReturn(Optional.of(dataset));
    given(storagePort.headObject(OBJECT_KEY))
        .willReturn(Optional.of(new ObjectMetadata(EXPECTED_SIZE, "\"etag\"")));
    given(datasetRepository.save(any())).willAnswer(invocation -> invocation.getArgument(0));

    CompleteRawFileUploadResult result = service.complete(command());

    // defaults가 적용되어 정상 완료
    assertThat(result.status()).isEqualTo(DatasetStatus.PROCESSING);

    org.mockito.ArgumentCaptor<com.init.corpus.domain.model.DatasetRawFile> captor =
        org.mockito.ArgumentCaptor.forClass(com.init.corpus.domain.model.DatasetRawFile.class);
    verify(rawFileRepository).save(captor.capture());
    assertThat(captor.getValue().getOriginalFilename()).isEqualTo("upload.zip");
    assertThat(captor.getValue().getContentType()).isEqualTo("application/zip");
  }

  @Test
  @DisplayName("should_promote_key_without_pending_prefix_unchanged")
  void complete_objectKeyWithoutPendingPrefix_returnsKeyUnchanged() {
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    Dataset dataset = Dataset.createUploading(1L, "test-key", "테스트", "CRM", 1L);
    ReflectionTestUtils.setField(dataset, "id", 42L);

    // 이미 pending 접두사 없는 키로 멱등 경로(이미 PROCESSING)
    dataset.markProcessing();
    String nonPendingMeta =
        "{\"upload\":{\"objectKey\":\"direct/key.zip\",\"expectedSizeBytes\":"
            + EXPECTED_SIZE
            + ",\"filename\":\"data.zip\",\"contentType\":\"application/zip\",\"expiresAt\":\""
            + OffsetDateTime.now().plusMinutes(15)
            + "\",\"createdBy\":1}}";
    dataset.updateMetaJson(nonPendingMeta);
    given(datasetRepository.findByIdAndWorkspaceIdForUpdate(42L, 1L))
        .willReturn(Optional.of(dataset));

    CompleteRawFileUploadResult result = service.complete(command());

    // pending/ 접두사 없으면 promoted key는 원본 그대로
    assertThat(result.objectKey()).isEqualTo("direct/key.zip");
    verify(storagePort, never()).headObject(anyString());
  }
}
