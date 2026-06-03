package com.init.corpus.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.corpus.application.DatasetUploadService;
import com.init.corpus.application.RawDatasetUploadService;
import com.init.corpus.application.RawFileUploadResult;
import com.init.corpus.application.RawFileUploadService;
import com.init.corpus.application.exception.DatasetKeyConflictException;
import com.init.corpus.application.exception.RawFileParseException;
import com.init.corpus.application.exception.UnauthorizedWorkspaceAccessException;
import com.init.corpus.application.exception.WorkspaceNotFoundException;
import com.init.corpus.domain.model.DatasetStatus;
import com.init.corpus.domain.model.PiiRedactionStatus;
import com.init.fixtures.WithLongPrincipal;
import com.init.shared.application.exception.QuotaExceededException;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * DatasetController — raw-file upload 엔드포인트 테스트.
 *
 * <p>NI-1 Option B 채택 (Assumption): {@link WithLongPrincipal} 어노테이션으로 Long principal을
 * SecurityContext에 주입한다. CSRF가 활성화되어 모든 POST 요청에 {@code .with(csrf())}를 명시한다.
 */
@WebMvcTest(
    value = DatasetController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
class DatasetControllerRawFileTest {

  @Autowired private MockMvc mockMvc;

  @MockitoBean private RawFileUploadService rawFileUploadService;

  @MockitoBean private RawDatasetUploadService rawDatasetUploadService;

  @MockitoBean private DatasetUploadService datasetUploadService;

  private static final byte[] VALID_ZIP = new byte[] {0x50, 0x4b, 0x03, 0x04};

  private RawFileUploadResult validResult() {
    return new RawFileUploadResult(
        42L,
        "test-key",
        1L,
        "workspaces/1/datasets/test-key/uuid_test.zip",
        "test.zip",
        VALID_ZIP.length,
        DatasetStatus.READY,
        PiiRedactionStatus.PENDING,
        1);
  }

  @Test
  @DisplayName("POST /raw-file — 성공 시 201 반환")
  @WithLongPrincipal(1L)
  void uploadRawFile_returns201() throws Exception {
    given(rawFileUploadService.upload(any())).willReturn(validResult());

    MockMultipartFile mockFile =
        new MockMultipartFile("file", "test.zip", "application/zip", VALID_ZIP);

    mockMvc
        .perform(
            multipart("/api/v1/workspaces/1/datasets/raw-file")
                .file(mockFile)
                .param("datasetKey", "test-key")
                .param("name", "테스트 데이터셋")
                .param("sourceType", "CRM")
                .with(csrf()))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.datasetId").value(42))
        .andExpect(jsonPath("$.objectKey").isString())
        .andExpect(jsonPath("$.conversationCount").value(1));
  }

  @Test
  @DisplayName("POST /raw-file — file 파트 없음(비어있음) 시 400")
  @WithLongPrincipal(1L)
  void uploadRawFile_emptyFile_returns400() throws Exception {
    MockMultipartFile emptyFile =
        new MockMultipartFile("file", "empty.zip", "application/zip", new byte[0]);

    mockMvc
        .perform(
            multipart("/api/v1/workspaces/1/datasets/raw-file")
                .file(emptyFile)
                .param("datasetKey", "test-key")
                .param("name", "테스트 데이터셋")
                .param("sourceType", "CRM")
                .with(csrf()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
  }

  @Test
  @DisplayName("POST /raw-file — ZIP이 아닌 파일 → 400 VALIDATION_ERROR")
  @WithLongPrincipal(1L)
  void uploadRawFile_nonZipFile_returns400() throws Exception {
    given(rawFileUploadService.upload(any()))
        .willThrow(new RawFileParseException("ZIP 파일만 업로드할 수 있습니다."));

    MockMultipartFile mockFile =
        new MockMultipartFile("file", "bad.json", "application/json", "NOT JSON".getBytes());

    mockMvc
        .perform(
            multipart("/api/v1/workspaces/1/datasets/raw-file")
                .file(mockFile)
                .param("datasetKey", "test-key")
                .param("name", "테스트")
                .param("sourceType", "CRM")
                .with(csrf()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
  }

  @Test
  @DisplayName("POST /raw-file — 워크스페이스 없음 → 404")
  @WithLongPrincipal(1L)
  void uploadRawFile_workspaceNotFound_returns404() throws Exception {
    given(rawFileUploadService.upload(any()))
        .willThrow(new WorkspaceNotFoundException("워크스페이스 없음"));

    MockMultipartFile mockFile =
        new MockMultipartFile("file", "test.zip", "application/zip", VALID_ZIP);

    mockMvc
        .perform(
            multipart("/api/v1/workspaces/999/datasets/raw-file")
                .file(mockFile)
                .param("datasetKey", "test-key")
                .param("name", "테스트")
                .param("sourceType", "CRM")
                .with(csrf()))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("WORKSPACE_NOT_FOUND"));
  }

  @Test
  @DisplayName("POST /raw-file — 비멤버 접근 → 403")
  @WithLongPrincipal(1L)
  void uploadRawFile_unauthorized_returns403() throws Exception {
    given(rawFileUploadService.upload(any()))
        .willThrow(new UnauthorizedWorkspaceAccessException("접근 권한 없음"));

    MockMultipartFile mockFile =
        new MockMultipartFile("file", "test.zip", "application/zip", VALID_ZIP);

    mockMvc
        .perform(
            multipart("/api/v1/workspaces/1/datasets/raw-file")
                .file(mockFile)
                .param("datasetKey", "test-key")
                .param("name", "테스트")
                .param("sourceType", "CRM")
                .with(csrf()))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("POST /raw-file — file 파트 완전 누락 → 400 VALIDATION_ERROR")
  @WithLongPrincipal(1L)
  void uploadRawFile_missingFilePart_returns400() throws Exception {
    mockMvc
        .perform(
            multipart("/api/v1/workspaces/1/datasets/raw-file")
                .param("datasetKey", "test-key")
                .param("name", "테스트 데이터셋")
                .param("sourceType", "CRM")
                .with(csrf()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
  }

  @Test
  @DisplayName("POST /raw-file — datasetKey 파라미터 누락 → 400 VALIDATION_ERROR")
  @WithLongPrincipal(1L)
  void uploadRawFile_missingDatasetKey_returns400() throws Exception {
    MockMultipartFile mockFile =
        new MockMultipartFile("file", "test.zip", "application/zip", VALID_ZIP);

    mockMvc
        .perform(
            multipart("/api/v1/workspaces/1/datasets/raw-file")
                .file(mockFile)
                .param("name", "테스트 데이터셋")
                .param("sourceType", "CRM")
                .with(csrf()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
  }

  @Test
  @DisplayName("POST /raw-file — datasetKey 중복 → 409")
  @WithLongPrincipal(1L)
  void uploadRawFile_datasetKeyConflict_returns409() throws Exception {
    given(rawFileUploadService.upload(any()))
        .willThrow(new DatasetKeyConflictException("이미 사용 중인 키"));

    MockMultipartFile mockFile =
        new MockMultipartFile("file", "test.zip", "application/zip", VALID_ZIP);

    mockMvc
        .perform(
            multipart("/api/v1/workspaces/1/datasets/raw-file")
                .file(mockFile)
                .param("datasetKey", "dup-key")
                .param("name", "테스트")
                .param("sourceType", "CRM")
                .with(csrf()))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("DATASET_KEY_CONFLICT"));
  }

  @Test
  @DisplayName("POST /raw-file — quota 초과 → 409 QUOTA_EXCEEDED")
  @WithLongPrincipal(1L)
  void uploadRawFile_quotaExceeded_returns409() throws Exception {
    given(rawFileUploadService.upload(any()))
        .willThrow(new QuotaExceededException("DATASET_UPLOAD", 3, 3));

    MockMultipartFile mockFile =
        new MockMultipartFile("file", "test.zip", "application/zip", VALID_ZIP);

    mockMvc
        .perform(
            multipart("/api/v1/workspaces/1/datasets/raw-file")
                .file(mockFile)
                .param("datasetKey", "next-key")
                .param("name", "테스트")
                .param("sourceType", "CRM")
                .with(csrf()))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("QUOTA_EXCEEDED"))
        .andExpect(jsonPath("$.resource").value("DATASET_UPLOAD"))
        .andExpect(jsonPath("$.limit").value(3))
        .andExpect(jsonPath("$.used").value(3));
  }
}
