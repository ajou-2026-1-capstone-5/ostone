package com.init.corpus.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.corpus.application.RawDatasetUploadCommand.RawConversationInput;
import com.init.corpus.application.exception.DatasetKeyConflictException;
import com.init.corpus.application.exception.RawFileParseException;
import com.init.corpus.application.exception.UnauthorizedWorkspaceAccessException;
import com.init.corpus.application.exception.WorkspaceNotFoundException;
import com.init.corpus.application.port.IngestionTriggerPort;
import com.init.corpus.application.port.RawFileStoragePort;
import com.init.corpus.domain.model.DatasetRawFile;
import com.init.corpus.domain.model.DatasetStatus;
import com.init.corpus.domain.model.PiiRedactionStatus;
import com.init.corpus.domain.repository.DatasetRawFileRepository;
import com.init.corpus.domain.repository.DatasetRepository;
import com.init.corpus.domain.repository.WorkspaceExistenceRepository;
import com.init.corpus.domain.repository.WorkspaceMembershipRepository;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("RawFileUploadService")
class RawFileUploadServiceTest {

  @Mock private WorkspaceExistenceRepository workspaceExistenceRepository;
  @Mock private WorkspaceMembershipRepository workspaceMembershipRepository;
  @Mock private DatasetRepository datasetRepository;
  @Mock private RawFileStoragePort storagePort;
  @Mock private RawDatasetUploadService rawDatasetUploadService;
  @Mock private DatasetRawFileRepository rawFileRepository;
  @Mock private IngestionTriggerPort triggerPort;

  private RawFileUploadService service;

  private static final byte[] VALID_JSON =
      ("[{\"source_id\":\"001\",\"source\":\"테스트\","
              + "\"consulting_category\":\"배송\",\"client_gender\":\"\","
              + "\"client_age\":\"\",\"consulting_content\":"
              + "\"상담사: 안녕하세요.\\n고객: 문의가 있어요.\"}]")
          .getBytes(StandardCharsets.UTF_8);

  @BeforeEach
  void setUp() {
    service =
        new RawFileUploadService(
            workspaceExistenceRepository,
            workspaceMembershipRepository,
            datasetRepository,
            storagePort,
            rawDatasetUploadService,
            rawFileRepository,
            triggerPort,
            new ObjectMapper());
  }

  @Test
  @DisplayName("should_성공_when_유효한_multipart_파일")
  void upload_success_returnsRawFileUploadResult() {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "test-key")).willReturn(false);
    given(storagePort.put(anyString(), any(), anyString())).willReturn("some-key");

    DatasetUploadResult uploadResult =
        new DatasetUploadResult(
            42L, "test-key", 1L, DatasetStatus.READY, PiiRedactionStatus.PENDING, 1);
    given(rawDatasetUploadService.upload(any())).willReturn(uploadResult);

    DatasetRawFile savedFile =
        DatasetRawFile.create(
            42L, "some-key", "test.json", "application/json", 100L, "a".repeat(64));
    given(rawFileRepository.save(any())).willReturn(savedFile);

    RawFileUploadCommand command =
        new RawFileUploadCommand(
            1L,
            "test-key",
            "테스트",
            "CRM",
            1L,
            VALID_JSON,
            "test.json",
            "application/json",
            VALID_JSON.length);

    RawFileUploadResult result = service.upload(command);

    assertThat(result.datasetId()).isEqualTo(42L);
    assertThat(result.datasetKey()).isEqualTo("test-key");
    verify(storagePort).put(anyString(), any(), anyString());
    verify(rawDatasetUploadService).upload(any());
    verify(rawFileRepository).save(any());
    verify(triggerPort).trigger(anyLong(), anyLong(), anyString());
  }

  @Test
  @DisplayName("should_parse_turn_based_json_files_in_zip")
  void upload_turnBasedZip_parsesConversations() throws IOException {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "prod-zip")).willReturn(false);
    given(storagePort.put(anyString(), any(), anyString())).willReturn("some-key");

    DatasetUploadResult uploadResult =
        new DatasetUploadResult(
            43L, "prod-zip", 1L, DatasetStatus.READY, PiiRedactionStatus.PENDING, 2);
    given(rawDatasetUploadService.upload(any())).willReturn(uploadResult);
    given(rawFileRepository.save(any()))
        .willReturn(
            DatasetRawFile.create(
                43L, "some-key", "prod.zip", "application/zip", 100L, "b".repeat(64)));

    byte[] zipBytes =
        zip(
            "a.json",
            """
            [{"source_id":"active-001","turns":[
              {"speaker_role":"CUSTOMER","message_text":"예약 변경하고 싶어요."},
              {"speaker_role":"AGENT","message_text":"예약 번호를 확인해 드릴게요."}
            ]}]
            """,
            "nested/b.json",
            """
            [{"source_id":"active-002","turns":[
              {"speaker_role":"AGENT","message_text":"상담원입니다."},
              {"speaker_role":"CUSTOMER","message_text":"취소 수수료 문의드립니다."}
            ]}]
            """);

    RawFileUploadCommand command =
        new RawFileUploadCommand(
            1L,
            "prod-zip",
            "운영 ZIP",
            "PARSED_FLAT_ZIP",
            1L,
            zipBytes,
            "prod.zip",
            "application/zip",
            (long) zipBytes.length);

    service.upload(command);

    ArgumentCaptor<RawDatasetUploadCommand> commandCaptor =
        ArgumentCaptor.forClass(RawDatasetUploadCommand.class);
    verify(rawDatasetUploadService).upload(commandCaptor.capture());

    List<RawConversationInput> conversations = commandCaptor.getValue().conversations();
    assertThat(conversations).hasSize(2);
    assertThat(conversations.get(0).sourceId()).isEqualTo("active-001");
    assertThat(conversations.get(0).consultingContent())
        .contains("고객: 예약 변경하고 싶어요.", "상담사: 예약 번호를 확인해 드릴게요.");
    assertThat(conversations.get(1).sourceId()).isEqualTo("active-002");
    assertThat(conversations.get(1).consultingContent())
        .contains("상담사: 상담원입니다.", "고객: 취소 수수료 문의드립니다.");
  }

  @Test
  @DisplayName("should_throw_WorkspaceNotFoundException_when_워크스페이스_없음")
  void upload_workspaceNotFound_throwsException() {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(false);

    RawFileUploadCommand command =
        new RawFileUploadCommand(
            1L,
            "key",
            "name",
            "src",
            1L,
            VALID_JSON,
            "f.json",
            "application/json",
            (long) VALID_JSON.length);

    assertThatThrownBy(() -> service.upload(command))
        .isInstanceOf(WorkspaceNotFoundException.class);

    verify(storagePort, never()).put(anyString(), any(), anyString());
  }

  @Test
  @DisplayName("should_throw_UnauthorizedWorkspaceAccessException_when_비멤버")
  void upload_notMember_throwsException() {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(false);

    RawFileUploadCommand command =
        new RawFileUploadCommand(
            1L,
            "key",
            "name",
            "src",
            1L,
            VALID_JSON,
            "f.json",
            "application/json",
            (long) VALID_JSON.length);

    assertThatThrownBy(() -> service.upload(command))
        .isInstanceOf(UnauthorizedWorkspaceAccessException.class);

    verify(storagePort, never()).put(anyString(), any(), anyString());
  }

  @Test
  @DisplayName("should_throw_DatasetKeyConflictException_when_키_중복")
  void upload_datasetKeyConflict_throwsException() {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "dup-key")).willReturn(true);

    RawFileUploadCommand command =
        new RawFileUploadCommand(
            1L,
            "dup-key",
            "name",
            "src",
            1L,
            VALID_JSON,
            "f.json",
            "application/json",
            (long) VALID_JSON.length);

    assertThatThrownBy(() -> service.upload(command))
        .isInstanceOf(DatasetKeyConflictException.class);

    verify(storagePort, never()).put(anyString(), any(), anyString());
  }

  @Test
  @DisplayName("should_throw_RawFileParseException_when_잘못된_JSON")
  void upload_invalidJson_throwsRawFileParseException() {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "key")).willReturn(false);
    given(storagePort.put(anyString(), any(), anyString())).willReturn("some-key");

    byte[] badJson = "NOT JSON".getBytes(StandardCharsets.UTF_8);
    RawFileUploadCommand command =
        new RawFileUploadCommand(
            1L, "key", "name", "src", 1L, badJson, "f.json", "application/json", 8L);

    assertThatThrownBy(() -> service.upload(command)).isInstanceOf(RawFileParseException.class);

    // orphan cleanup: S3 delete called after parse failure
    verify(storagePort).delete(anyString());
  }

  @Test
  @DisplayName("should_delete_S3_orphan_when_DB_실패")
  void upload_dbFailure_deletesS3Orphan() {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "key")).willReturn(false);
    given(storagePort.put(anyString(), any(), anyString())).willReturn("some-key");
    given(rawDatasetUploadService.upload(any())).willThrow(new RuntimeException("DB error"));

    RawFileUploadCommand command =
        new RawFileUploadCommand(
            1L,
            "key",
            "name",
            "src",
            1L,
            VALID_JSON,
            "f.json",
            "application/json",
            (long) VALID_JSON.length);

    assertThatThrownBy(() -> service.upload(command))
        .isInstanceOf(RuntimeException.class)
        .hasMessage("DB error");

    verify(storagePort).delete(anyString());
  }

  @Test
  @DisplayName("should_delete_S3_orphan_when_rawFileRepo_save_fails")
  void upload_rawFileRepoSaveFails_deletesS3Orphan() {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "key")).willReturn(false);
    given(storagePort.put(anyString(), any(), anyString())).willReturn("some-key");

    DatasetUploadResult uploadResult =
        new DatasetUploadResult(42L, "key", 1L, DatasetStatus.READY, PiiRedactionStatus.PENDING, 1);
    given(rawDatasetUploadService.upload(any())).willReturn(uploadResult);
    given(rawFileRepository.save(any())).willThrow(new RuntimeException("DB save error"));

    RawFileUploadCommand command =
        new RawFileUploadCommand(
            1L,
            "key",
            "name",
            "src",
            1L,
            VALID_JSON,
            "f.json",
            "application/json",
            (long) VALID_JSON.length);

    assertThatThrownBy(() -> service.upload(command))
        .isInstanceOf(RuntimeException.class)
        .hasMessage("DB save error");

    verify(storagePort).delete(anyString());
  }

  @Test
  @DisplayName("should_propagate_original_exception_when_S3_delete_fails_during_orphan_cleanup")
  void upload_dbFailureWithS3DeleteFail_propagatesOriginalException() {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "key")).willReturn(false);
    given(storagePort.put(anyString(), any(), anyString())).willReturn("some-key");
    given(rawDatasetUploadService.upload(any())).willThrow(new RuntimeException("DB error"));
    willThrow(new RuntimeException("S3 delete failed")).given(storagePort).delete(anyString());

    RawFileUploadCommand command =
        new RawFileUploadCommand(
            1L,
            "key",
            "name",
            "src",
            1L,
            VALID_JSON,
            "f.json",
            "application/json",
            (long) VALID_JSON.length);

    // original DB exception must propagate, not the S3 delete exception
    assertThatThrownBy(() -> service.upload(command))
        .isInstanceOf(RuntimeException.class)
        .hasMessage("DB error");
  }

  private byte[] zip(String firstName, String firstContent, String secondName, String secondContent)
      throws IOException {
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
      zip.putNextEntry(new ZipEntry(firstName));
      zip.write(firstContent.getBytes(StandardCharsets.UTF_8));
      zip.closeEntry();
      zip.putNextEntry(new ZipEntry(secondName));
      zip.write(secondContent.getBytes(StandardCharsets.UTF_8));
      zip.closeEntry();
    }
    return bytes.toByteArray();
  }
}
