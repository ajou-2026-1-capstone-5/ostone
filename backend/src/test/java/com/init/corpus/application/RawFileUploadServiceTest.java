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
import com.init.shared.application.exception.QuotaExceededException;
import com.init.shared.application.quota.WorkspaceQuotaValidator;
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
  @Mock private WorkspaceQuotaValidator workspaceQuotaValidator;

  private RawFileUploadService service;

  private static final String VALID_JSON_TEXT =
      "[{\"source_id\":\"001\",\"source\":\"테스트\","
          + "\"consulting_category\":\"배송\",\"client_gender\":\"\","
          + "\"client_age\":\"\",\"consulting_content\":"
          + "\"상담사: 안녕하세요.\\n고객: 문의가 있어요.\"}]";
  private static final byte[] VALID_JSON = VALID_JSON_TEXT.getBytes(StandardCharsets.UTF_8);

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
            new ObjectMapper(),
            workspaceQuotaValidator);
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
        DatasetRawFile.create(42L, "some-key", "test.zip", "application/zip", 100L, "a".repeat(64));
    given(rawFileRepository.save(any())).willReturn(savedFile);

    byte[] zipBytes = validZipBytes();
    RawFileUploadCommand command =
        new RawFileUploadCommand(
            1L,
            "test-key",
            "테스트",
            "CRM",
            1L,
            zipBytes,
            "test.zip",
            "application/zip",
            (long) zipBytes.length);

    RawFileUploadResult result = service.upload(command);

    assertThat(result.datasetId()).isEqualTo(42L);
    assertThat(result.datasetKey()).isEqualTo("test-key");
    verify(storagePort).put(anyString(), any(), anyString());
    verify(rawDatasetUploadService).upload(any());
    verify(rawFileRepository).save(any());
    verify(triggerPort).trigger(anyLong(), anyLong(), anyString());
  }

  @Test
  @DisplayName("quota 초과 시 S3 업로드 전에 차단한다")
  void upload_quotaExceeded_doesNotPutFile() {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "test-key")).willReturn(false);
    willThrow(new QuotaExceededException("DATASET_UPLOAD", 3, 3))
        .given(workspaceQuotaValidator)
        .assertDatasetUploadAllowed(1L);

    byte[] zipBytes = validZipBytes();
    RawFileUploadCommand command =
        new RawFileUploadCommand(
            1L,
            "test-key",
            "테스트",
            "CRM",
            1L,
            zipBytes,
            "test.zip",
            "application/zip",
            (long) zipBytes.length);

    assertThatThrownBy(() -> service.upload(command)).isInstanceOf(QuotaExceededException.class);

    verify(storagePort, never()).put(anyString(), any(), anyString());
    verify(rawDatasetUploadService, never()).upload(any());
    verify(triggerPort, never()).trigger(anyLong(), anyLong(), anyString());
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
        .containsSubsequence("고객: 예약 변경하고 싶어요.", "상담사: 예약 번호를 확인해 드릴게요.");
    assertThat(conversations.get(1).sourceId()).isEqualTo("active-002");
    assertThat(conversations.get(1).consultingContent())
        .containsSubsequence("상담사: 상담원입니다.", "고객: 취소 수수료 문의드립니다.");
  }

  @Test
  @DisplayName("should_ignore_macos_metadata_directory_entries_in_zip")
  void upload_zipWithMacOsMetadataDirectory_ignoresMetadataEntries() throws IOException {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "macos-dir-zip"))
        .willReturn(false);
    given(storagePort.put(anyString(), any(), anyString())).willReturn("some-key");
    given(rawDatasetUploadService.upload(any()))
        .willReturn(
            new DatasetUploadResult(
                50L, "macos-dir-zip", 1L, DatasetStatus.READY, PiiRedactionStatus.PENDING, 1));
    given(rawFileRepository.save(any()))
        .willReturn(
            DatasetRawFile.create(
                50L, "some-key", "macos.zip", "application/zip", 100L, "f".repeat(64)));

    // macOS Archive Utility가 끼워 넣는 __MACOSX/._*.json AppleDouble 항목(NUL 바이트 포함).
    // 무시되지 않으면 .json 확장자 때문에 파싱 대상이 되어 RawFileParseException이 발생한다.
    byte[] zipBytes = zip("__MACOSX/._logs.json", "  mac-metadata", "logs.json", VALID_JSON_TEXT);
    RawFileUploadCommand command =
        new RawFileUploadCommand(
            1L,
            "macos-dir-zip",
            "맥 메타데이터 ZIP",
            "PARSED_FLAT_ZIP",
            1L,
            zipBytes,
            "macos.zip",
            "application/zip",
            (long) zipBytes.length);

    RawFileUploadResult result = service.upload(command);

    assertThat(result.datasetId()).isEqualTo(50L);
    ArgumentCaptor<RawDatasetUploadCommand> commandCaptor =
        ArgumentCaptor.forClass(RawDatasetUploadCommand.class);
    verify(rawDatasetUploadService).upload(commandCaptor.capture());
    List<RawConversationInput> conversations = commandCaptor.getValue().conversations();
    assertThat(conversations).hasSize(1);
    assertThat(conversations.get(0).sourceId()).isEqualTo("001");
  }

  @Test
  @DisplayName("should_ignore_top_level_apple_double_entries_in_zip")
  void upload_zipWithAppleDoubleEntry_ignoresMetadataEntries() throws IOException {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "apple-double-zip"))
        .willReturn(false);
    given(storagePort.put(anyString(), any(), anyString())).willReturn("some-key");
    given(rawDatasetUploadService.upload(any()))
        .willReturn(
            new DatasetUploadResult(
                51L, "apple-double-zip", 1L, DatasetStatus.READY, PiiRedactionStatus.PENDING, 1));
    given(rawFileRepository.save(any()))
        .willReturn(
            DatasetRawFile.create(
                51L, "some-key", "apple.zip", "application/zip", 100L, "1".repeat(64)));

    // __MACOSX 디렉터리 없이 최상위에 놓인 ._*.json AppleDouble 항목도 무시되어야 한다.
    byte[] zipBytes = zip("._logs.json", " mac-resource-fork", "logs.json", VALID_JSON_TEXT);
    RawFileUploadCommand command =
        new RawFileUploadCommand(
            1L,
            "apple-double-zip",
            "AppleDouble ZIP",
            "PARSED_FLAT_ZIP",
            1L,
            zipBytes,
            "apple.zip",
            "application/zip",
            (long) zipBytes.length);

    RawFileUploadResult result = service.upload(command);

    assertThat(result.datasetId()).isEqualTo(51L);
    ArgumentCaptor<RawDatasetUploadCommand> commandCaptor =
        ArgumentCaptor.forClass(RawDatasetUploadCommand.class);
    verify(rawDatasetUploadService).upload(commandCaptor.capture());
    assertThat(commandCaptor.getValue().conversations()).hasSize(1);
  }

  @Test
  @DisplayName("should_parse_json_object_with_data_array_inside_zip")
  void upload_zipEntryWithJsonObjectDataArray_parsesConversations() throws IOException {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "object-json")).willReturn(false);
    given(storagePort.put(anyString(), any(), anyString())).willReturn("some-key");
    DatasetUploadResult uploadResult =
        new DatasetUploadResult(
            44L, "object-json", 1L, DatasetStatus.READY, PiiRedactionStatus.PENDING, 2);
    given(rawDatasetUploadService.upload(any())).willReturn(uploadResult);
    given(rawFileRepository.save(any()))
        .willReturn(
            DatasetRawFile.create(
                44L, "some-key", "object.zip", "application/zip", 100L, "c".repeat(64)));
    byte[] zipBytes =
        zip(
            "object.json",
            """
        {"data":[
          {"id":"obj-001","channel":"톡","consulting_category":"카드","full_text":"분실 정지 문의"},
          {"case_id":"obj-002","source":"전화","conversation":"한도 상향 문의"}
        ]}
        """);

    service.upload(
        new RawFileUploadCommand(
            1L,
            "object-json",
            "객체 JSON",
            "PARSED_FLAT_ZIP",
            1L,
            zipBytes,
            "object.zip",
            "application/zip",
            (long) zipBytes.length));

    ArgumentCaptor<RawDatasetUploadCommand> commandCaptor =
        ArgumentCaptor.forClass(RawDatasetUploadCommand.class);
    verify(rawDatasetUploadService).upload(commandCaptor.capture());

    List<RawConversationInput> conversations = commandCaptor.getValue().conversations();
    assertThat(conversations)
        .extracting(RawConversationInput::sourceId)
        .containsExactly("obj-001", "obj-002");
    assertThat(conversations).extracting(RawConversationInput::source).containsExactly("톡", "전화");
    assertThat(conversations)
        .extracting(RawConversationInput::consultingContent)
        .containsExactly("분실 정지 문의", "한도 상향 문의");
  }

  @Test
  @DisplayName("should_parse_jsonl_entries_inside_zip")
  void upload_jsonlZipEntry_parsesConversations() throws IOException {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "jsonl-zip")).willReturn(false);
    given(storagePort.put(anyString(), any(), anyString())).willReturn("some-key");
    DatasetUploadResult uploadResult =
        new DatasetUploadResult(
            45L, "jsonl-zip", 1L, DatasetStatus.READY, PiiRedactionStatus.PENDING, 2);
    given(rawDatasetUploadService.upload(any())).willReturn(uploadResult);
    given(rawFileRepository.save(any()))
        .willReturn(
            DatasetRawFile.create(
                45L, "some-key", "jsonl.zip", "application/zip", 100L, "d".repeat(64)));
    byte[] zipBytes =
        zip(
            "logs.jsonl",
            """
            {"source_id":"jsonl-001","text":"배송지 변경"}

            {"items":[{"source_id":"jsonl-002","content":"결제 취소"}]}
            """);

    service.upload(
        new RawFileUploadCommand(
            1L,
            "jsonl-zip",
            "JSONL ZIP",
            "PARSED_FLAT_ZIP",
            1L,
            zipBytes,
            "jsonl.zip",
            "application/zip",
            (long) zipBytes.length));

    ArgumentCaptor<RawDatasetUploadCommand> commandCaptor =
        ArgumentCaptor.forClass(RawDatasetUploadCommand.class);
    verify(rawDatasetUploadService).upload(commandCaptor.capture());

    assertThat(commandCaptor.getValue().conversations())
        .extracting(RawConversationInput::sourceId)
        .containsExactly("jsonl-001", "jsonl-002");
  }

  @Test
  @DisplayName("should_build_content_from_turns_with_korean_speaker_roles")
  void upload_turnsWithKoreanSpeakerRoles_buildsConsultingContent() throws IOException {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "turn-json")).willReturn(false);
    given(storagePort.put(anyString(), any(), anyString())).willReturn("some-key");
    DatasetUploadResult uploadResult =
        new DatasetUploadResult(
            46L, "turn-json", 1L, DatasetStatus.READY, PiiRedactionStatus.PENDING, 1);
    given(rawDatasetUploadService.upload(any())).willReturn(uploadResult);
    given(rawFileRepository.save(any()))
        .willReturn(
            DatasetRawFile.create(
                46L, "some-key", "turns.zip", "application/zip", 100L, "e".repeat(64)));
    byte[] zipBytes =
        zip(
            "turns.json",
            """
        [{"source_id":"turn-001","turns":[
          {"화자":"직원","발화":"본인 확인 도와드리겠습니다."},
          {"role":"customer","utterance":"네."},
          {"speaker":"system","text":""}
        ]}]
        """);

    service.upload(
        new RawFileUploadCommand(
            1L,
            "turn-json",
            "턴 JSON",
            "PARSED_FLAT_ZIP",
            1L,
            zipBytes,
            "turns.zip",
            "application/zip",
            (long) zipBytes.length));

    ArgumentCaptor<RawDatasetUploadCommand> commandCaptor =
        ArgumentCaptor.forClass(RawDatasetUploadCommand.class);
    verify(rawDatasetUploadService).upload(commandCaptor.capture());

    assertThat(commandCaptor.getValue().conversations().getFirst().consultingContent())
        .containsSubsequence("상담사: 본인 확인 도와드리겠습니다.", "고객: 네.");
  }

  @Test
  @DisplayName("should_reject_empty_json_entry_inside_zip")
  void upload_zipWithEmptyJsonEntry_throwsRawFileParseException() throws IOException {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "empty-json")).willReturn(false);
    given(storagePort.put(anyString(), any(), anyString())).willReturn("some-key");

    byte[] zipBytes = zip("empty.json", "  \n ");
    RawFileUploadCommand command =
        new RawFileUploadCommand(
            1L,
            "empty-json",
            "빈 JSON",
            "PARSED_FLAT_ZIP",
            1L,
            zipBytes,
            "empty.zip",
            "application/zip",
            (long) zipBytes.length);

    assertThatThrownBy(() -> service.upload(command))
        .isInstanceOf(RawFileParseException.class)
        .hasMessageContaining("상담 데이터가 없습니다");

    verify(storagePort).delete(anyString());
    verify(rawDatasetUploadService, never()).upload(any());
  }

  @Test
  @DisplayName("should_reject_json_entry_without_conversation_nodes")
  void upload_zipWithScalarJsonEntry_throwsRawFileParseException() throws IOException {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "scalar-json")).willReturn(false);
    given(storagePort.put(anyString(), any(), anyString())).willReturn("some-key");

    byte[] zipBytes = zip("scalar.json", "123");
    RawFileUploadCommand command =
        new RawFileUploadCommand(
            1L,
            "scalar-json",
            "스칼라 JSON",
            "PARSED_FLAT_ZIP",
            1L,
            zipBytes,
            "scalar.zip",
            "application/zip",
            (long) zipBytes.length);

    assertThatThrownBy(() -> service.upload(command))
        .isInstanceOf(RawFileParseException.class)
        .hasMessageContaining("상담 데이터가 없습니다");

    verify(storagePort).delete(anyString());
    verify(rawDatasetUploadService, never()).upload(any());
  }

  @Test
  @DisplayName("should_reject_json_entry_missing_consulting_content")
  void upload_zipWithJsonEntryMissingConsultingContent_throwsRawFileParseException()
      throws IOException {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "missing-content"))
        .willReturn(false);
    given(storagePort.put(anyString(), any(), anyString())).willReturn("some-key");

    byte[] zipBytes = zip("missing.json", "[{\"source_id\":\"bad-001\",\"turns\":[]}]");
    RawFileUploadCommand command =
        new RawFileUploadCommand(
            1L,
            "missing-content",
            "본문 없음",
            "PARSED_FLAT_ZIP",
            1L,
            zipBytes,
            "missing.zip",
            "application/zip",
            (long) zipBytes.length);

    assertThatThrownBy(() -> service.upload(command))
        .isInstanceOf(RawFileParseException.class)
        .hasMessageContaining("상담 데이터 형식");

    verify(storagePort).delete(anyString());
    verify(rawDatasetUploadService, never()).upload(any());
  }

  @Test
  @DisplayName("should_reject_zip_with_unsafe_entry_path")
  void upload_zipWithUnsafeEntryPath_throwsRawFileParseException() throws IOException {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "unsafe-zip")).willReturn(false);
    given(storagePort.put(anyString(), any(), anyString())).willReturn("some-key");

    byte[] zipBytes = zip("../evil.json", "[{\"source_id\":\"001\",\"consulting_content\":\"x\"}]");
    RawFileUploadCommand command =
        new RawFileUploadCommand(
            1L,
            "unsafe-zip",
            "위험 ZIP",
            "PARSED_FLAT_ZIP",
            1L,
            zipBytes,
            "unsafe.zip",
            "application/zip",
            (long) zipBytes.length);

    assertThatThrownBy(() -> service.upload(command))
        .isInstanceOf(RawFileParseException.class)
        .hasMessageContaining("안전하지 않은 경로");

    verify(storagePort).delete(anyString());
    verify(rawDatasetUploadService, never()).upload(any());
  }

  @Test
  @DisplayName("should_reject_zip_with_absolute_entry_path")
  void upload_zipWithAbsoluteEntryPath_throwsRawFileParseException() throws IOException {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "absolute-zip")).willReturn(false);
    given(storagePort.put(anyString(), any(), anyString())).willReturn("some-key");

    byte[] zipBytes = zip("/evil.json", "[{\"source_id\":\"001\",\"consulting_content\":\"x\"}]");
    RawFileUploadCommand command =
        new RawFileUploadCommand(
            1L,
            "absolute-zip",
            "위험 ZIP",
            "PARSED_FLAT_ZIP",
            1L,
            zipBytes,
            "absolute.zip",
            "application/zip",
            (long) zipBytes.length);

    assertThatThrownBy(() -> service.upload(command))
        .isInstanceOf(RawFileParseException.class)
        .hasMessageContaining("안전하지 않은 경로");

    verify(storagePort).delete(anyString());
    verify(rawDatasetUploadService, never()).upload(any());
  }

  @Test
  @DisplayName("should_reject_zip_with_windows_drive_entry_path")
  void upload_zipWithDriveEntryPath_throwsRawFileParseException() throws IOException {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "drive-zip")).willReturn(false);
    given(storagePort.put(anyString(), any(), anyString())).willReturn("some-key");

    byte[] zipBytes = zip("C:/evil.json", "[{\"source_id\":\"001\",\"consulting_content\":\"x\"}]");
    RawFileUploadCommand command =
        new RawFileUploadCommand(
            1L,
            "drive-zip",
            "위험 ZIP",
            "PARSED_FLAT_ZIP",
            1L,
            zipBytes,
            "drive.zip",
            "application/zip",
            (long) zipBytes.length);

    assertThatThrownBy(() -> service.upload(command))
        .isInstanceOf(RawFileParseException.class)
        .hasMessageContaining("안전하지 않은 경로");

    verify(storagePort).delete(anyString());
    verify(rawDatasetUploadService, never()).upload(any());
  }

  @Test
  @DisplayName("should_reject_zip_without_supported_conversation_entries")
  void upload_zipWithoutSupportedEntries_throwsRawFileParseException() throws IOException {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "empty-zip")).willReturn(false);
    given(storagePort.put(anyString(), any(), anyString())).willReturn("some-key");

    byte[] zipBytes = zip("notes.txt", "not conversation data");
    RawFileUploadCommand command =
        new RawFileUploadCommand(
            1L,
            "empty-zip",
            "빈 ZIP",
            "PARSED_FLAT_ZIP",
            1L,
            zipBytes,
            "empty.zip",
            "application/zip",
            (long) zipBytes.length);

    assertThatThrownBy(() -> service.upload(command))
        .isInstanceOf(RawFileParseException.class)
        .hasMessageContaining("상담 데이터가 없습니다");

    verify(storagePort).delete(anyString());
    verify(rawDatasetUploadService, never()).upload(any());
  }

  @Test
  @DisplayName("should_reject_non_zip_before_storage")
  void upload_nonZipFile_throwsRawFileParseExceptionBeforeStorage() {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "json-file")).willReturn(false);

    RawFileUploadCommand command =
        new RawFileUploadCommand(
            1L,
            "json-file",
            "단일 JSON",
            "PARSED_FLAT_JSON",
            1L,
            VALID_JSON,
            "logs.json",
            "application/json",
            (long) VALID_JSON.length);

    assertThatThrownBy(() -> service.upload(command))
        .isInstanceOf(RawFileParseException.class)
        .hasMessageContaining("ZIP 파일만 업로드할 수 있습니다.");

    verify(storagePort, never()).put(anyString(), any(), anyString());
    verify(storagePort, never()).delete(anyString());
    verify(rawDatasetUploadService, never()).upload(any());
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
  @DisplayName("should_throw_RawFileParseException_when_ZIP_내부_JSON_잘못됨")
  void upload_zipWithInvalidJsonEntry_throwsRawFileParseException() throws IOException {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "key")).willReturn(false);
    given(storagePort.put(anyString(), any(), anyString())).willReturn("some-key");

    byte[] zipBytes = zip("bad.json", "NOT JSON");
    RawFileUploadCommand command =
        new RawFileUploadCommand(
            1L,
            "key",
            "name",
            "src",
            1L,
            zipBytes,
            "bad.zip",
            "application/zip",
            (long) zipBytes.length);

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

    byte[] zipBytes = validZipBytes();
    RawFileUploadCommand command =
        new RawFileUploadCommand(
            1L,
            "key",
            "name",
            "src",
            1L,
            zipBytes,
            "f.zip",
            "application/zip",
            (long) zipBytes.length);

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

    byte[] zipBytes = validZipBytes();
    RawFileUploadCommand command =
        new RawFileUploadCommand(
            1L,
            "key",
            "name",
            "src",
            1L,
            zipBytes,
            "f.zip",
            "application/zip",
            (long) zipBytes.length);

    assertThatThrownBy(() -> service.upload(command))
        .isInstanceOf(RuntimeException.class)
        .hasMessage("DB save error");

    verify(storagePort).delete(anyString());
  }

  @Test
  @DisplayName("should_delete_S3_orphan_when_ingestion_trigger_fails")
  void upload_ingestionTriggerFails_deletesS3Orphan() {
    given(workspaceExistenceRepository.existsById(1L)).willReturn(true);
    given(workspaceMembershipRepository.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(true);
    given(datasetRepository.existsByWorkspaceIdAndDatasetKey(1L, "key")).willReturn(false);
    given(storagePort.put(anyString(), any(), anyString())).willReturn("some-key");

    DatasetUploadResult uploadResult =
        new DatasetUploadResult(42L, "key", 1L, DatasetStatus.READY, PiiRedactionStatus.PENDING, 1);
    given(rawDatasetUploadService.upload(any())).willReturn(uploadResult);
    given(rawFileRepository.save(any()))
        .willReturn(
            DatasetRawFile.create(
                42L, "some-key", "f.zip", "application/zip", 100L, "a".repeat(64)));
    willThrow(new RuntimeException("trigger error"))
        .given(triggerPort)
        .trigger(anyLong(), anyLong(), anyString());

    byte[] zipBytes = validZipBytes();
    RawFileUploadCommand command =
        new RawFileUploadCommand(
            1L,
            "key",
            "name",
            "src",
            1L,
            zipBytes,
            "f.zip",
            "application/zip",
            (long) zipBytes.length);

    assertThatThrownBy(() -> service.upload(command))
        .isInstanceOf(RuntimeException.class)
        .hasMessage("trigger error");

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

    byte[] zipBytes = validZipBytes();
    RawFileUploadCommand command =
        new RawFileUploadCommand(
            1L,
            "key",
            "name",
            "src",
            1L,
            zipBytes,
            "f.zip",
            "application/zip",
            (long) zipBytes.length);

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

  private byte[] validZipBytes() {
    try {
      return zip("logs.json", VALID_JSON_TEXT);
    } catch (IOException e) {
      throw new IllegalStateException("테스트 ZIP 생성 실패", e);
    }
  }

  private byte[] zip(String name, String content) throws IOException {
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
      zip.putNextEntry(new ZipEntry(name));
      zip.write(content.getBytes(StandardCharsets.UTF_8));
      zip.closeEntry();
    }
    return bytes.toByteArray();
  }
}
