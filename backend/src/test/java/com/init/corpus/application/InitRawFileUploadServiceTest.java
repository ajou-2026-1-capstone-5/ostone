package com.init.corpus.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.corpus.application.exception.DatasetKeyConflictException;
import com.init.corpus.application.exception.UnauthorizedWorkspaceAccessException;
import com.init.corpus.application.exception.WorkspaceNotFoundException;
import com.init.corpus.application.port.RawFileStoragePort;
import com.init.corpus.domain.model.Dataset;
import com.init.corpus.domain.model.DatasetStatus;
import com.init.corpus.domain.repository.DatasetRepository;
import com.init.corpus.domain.repository.WorkspaceExistenceRepository;
import com.init.corpus.domain.repository.WorkspaceMembershipRepository;
import com.init.corpus.infrastructure.storage.StorageProperties;
import com.init.shared.application.exception.BadRequestException;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("InitRawFileUploadService")
class InitRawFileUploadServiceTest {

  @Mock private WorkspaceExistenceRepository workspaceExistenceRepository;
  @Mock private WorkspaceMembershipRepository workspaceMembershipRepository;
  @Mock private DatasetRepository datasetRepository;
  @Mock private RawFileStoragePort storagePort;

  private final ObjectMapper objectMapper = new ObjectMapper();
  private InitRawFileUploadService service;

  private static final StorageProperties SSE_ON =
      new StorageProperties("bucket", "ap-northeast-2", null, null, null, null, false, true);

  private InitRawFileUploadCommand command(long sizeBytes) {
    return command(sizeBytes, "application/zip");
  }

  private InitRawFileUploadCommand command(long sizeBytes, String contentType) {
    return new InitRawFileUploadCommand(
        1L, "test-key", "테스트", "CRM", 1L, "data.zip", contentType, sizeBytes);
  }

  @BeforeEach
  void setUp() {
    service =
        new InitRawFileUploadService(
            workspaceExistenceRepository,
            workspaceMembershipRepository,
            datasetRepository,
            storagePort,
            SSE_ON,
            objectMapper);
  }

  @Test
  @DisplayName("should_발급_presigned_url_and_persist_uploading_dataset")
  void init_success_returnsUploadUrl() throws Exception {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "test-key")).willReturn(false);
    given(storagePort.generatePresignedPutUrl(anyString(), eq("application/zip"), any()))
        .willReturn("https://s3/presigned");

    ArgumentCaptor<Dataset> datasetCaptor = ArgumentCaptor.forClass(Dataset.class);
    given(datasetRepository.save(datasetCaptor.capture()))
        .willAnswer(invocation -> invocation.getArgument(0));

    InitRawFileUploadResult result = service.init(command(1024L));

    assertThat(result.uploadUrl()).isEqualTo("https://s3/presigned");
    assertThat(result.objectKey()).startsWith("pending/workspaces/1/datasets/test-key/");
    assertThat(result.serverSideEncryptionRequired()).isTrue();
    assertThat(result.expiresInSeconds()).isEqualTo(Duration.ofMinutes(15).toSeconds());

    Dataset saved = datasetCaptor.getValue();
    assertThat(saved.getStatus()).isEqualTo(DatasetStatus.UPLOADING);
    JsonNode upload = objectMapper.readTree(saved.getMetaJson()).get("upload");
    assertThat(upload.get("objectKey").asText()).isEqualTo(result.objectKey());
    assertThat(upload.get("expectedSizeBytes").asLong()).isEqualTo(1024L);
    assertThat(upload.get("filename").asText()).isEqualTo("data.zip");
    assertThat(upload.get("contentType").asText()).isEqualTo("application/zip");
    assertThat(upload.get("createdBy").asLong()).isEqualTo(1L);
    assertThat(upload.hasNonNull("expiresAt")).isTrue();
  }

  @Test
  @DisplayName("should_throw_WorkspaceNotFoundException_when_워크스페이스_없음")
  void init_workspaceNotFound_throws() {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(false);

    assertThatThrownBy(() -> service.init(command(1024L)))
        .isInstanceOf(WorkspaceNotFoundException.class);

    verify(storagePort, never()).generatePresignedPutUrl(anyString(), anyString(), any());
    verify(datasetRepository, never()).save(any());
  }

  @Test
  @DisplayName("should_throw_UnauthorizedWorkspaceAccessException_when_비멤버")
  void init_notMember_throws() {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(false);

    assertThatThrownBy(() -> service.init(command(1024L)))
        .isInstanceOf(UnauthorizedWorkspaceAccessException.class);

    verify(datasetRepository, never()).save(any());
  }

  @Test
  @DisplayName("should_throw_DatasetKeyConflictException_when_키_중복")
  void init_datasetKeyConflict_throws() {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "test-key")).willReturn(true);

    assertThatThrownBy(() -> service.init(command(1024L)))
        .isInstanceOf(DatasetKeyConflictException.class);

    verify(datasetRepository, never()).save(any());
  }

  @Test
  @DisplayName("should_reject_non_zip_content_type")
  void init_nonZipContentType_throws() {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "test-key")).willReturn(false);

    assertThatThrownBy(() -> service.init(command(1024L, "application/octet-stream")))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("ZIP");

    verify(datasetRepository, never()).save(any());
    verify(storagePort, never()).generatePresignedPutUrl(anyString(), anyString(), any());
  }

  @Test
  @DisplayName("should_reject_size_over_4GB")
  void init_sizeOverLimit_throws() {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "test-key")).willReturn(false);

    long overLimit = InitRawFileUploadService.MAX_UPLOAD_BYTES + 1;

    assertThatThrownBy(() -> service.init(command(overLimit)))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("4GB");

    verify(datasetRepository, never()).save(any());
    verify(storagePort, never()).generatePresignedPutUrl(anyString(), anyString(), any());
  }
}
