package com.init.corpus.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.corpus.application.CompleteRawFileUploadResult;
import com.init.corpus.application.CompleteRawFileUploadService;
import com.init.corpus.application.DatasetUploadService;
import com.init.corpus.application.InitRawFileUploadResult;
import com.init.corpus.application.InitRawFileUploadService;
import com.init.corpus.application.RawDatasetUploadService;
import com.init.corpus.application.exception.DatasetKeyConflictException;
import com.init.corpus.application.exception.DatasetNotFoundException;
import com.init.corpus.application.exception.InvalidUploadStateException;
import com.init.corpus.application.exception.UnauthorizedWorkspaceAccessException;
import com.init.corpus.application.exception.WorkspaceNotFoundException;
import com.init.corpus.domain.model.DatasetStatus;
import com.init.fixtures.WithLongPrincipal;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** DatasetController — presigned raw-file 업로드 init/complete 엔드포인트 테스트. */
@WebMvcTest(
    value = DatasetController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
class DatasetControllerRawFileTest {

  @Autowired private MockMvc mockMvc;

  @MockitoBean private InitRawFileUploadService initRawFileUploadService;
  @MockitoBean private CompleteRawFileUploadService completeRawFileUploadService;
  @MockitoBean private RawDatasetUploadService rawDatasetUploadService;
  @MockitoBean private DatasetUploadService datasetUploadService;

  private static final String INIT_BODY =
      "{\"datasetKey\":\"test-key\",\"name\":\"테스트\",\"sourceType\":\"CRM\","
          + "\"filename\":\"data.zip\",\"contentType\":\"application/zip\",\"sizeBytes\":1024}";

  private InitRawFileUploadResult initResult() {
    return new InitRawFileUploadResult(
        42L,
        "test-key",
        1L,
        "https://s3.example.com/presigned",
        "pending/workspaces/1/datasets/test-key/uuid_data.zip",
        "application/zip",
        900L,
        true);
  }

  @Test
  @DisplayName("POST /uploads:init — 성공 시 201과 presigned URL 반환")
  @WithLongPrincipal(1L)
  void initUpload_returns201() throws Exception {
    given(initRawFileUploadService.init(any())).willReturn(initResult());

    mockMvc
        .perform(
            post("/api/v1/workspaces/1/datasets/uploads:init")
                .contentType(MediaType.APPLICATION_JSON)
                .content(INIT_BODY)
                .with(csrf()))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.datasetId").value(42))
        .andExpect(jsonPath("$.uploadUrl").isString())
        .andExpect(jsonPath("$.objectKey").isString())
        .andExpect(jsonPath("$.serverSideEncryptionRequired").value(true));
  }

  @Test
  @DisplayName("POST /uploads:init — datasetKey 중복 → 409")
  @WithLongPrincipal(1L)
  void initUpload_datasetKeyConflict_returns409() throws Exception {
    given(initRawFileUploadService.init(any()))
        .willThrow(new DatasetKeyConflictException("이미 사용 중인 키"));

    mockMvc
        .perform(
            post("/api/v1/workspaces/1/datasets/uploads:init")
                .contentType(MediaType.APPLICATION_JSON)
                .content(INIT_BODY)
                .with(csrf()))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("DATASET_KEY_CONFLICT"));
  }

  @Test
  @DisplayName("POST /uploads:init — 워크스페이스 없음 → 404")
  @WithLongPrincipal(1L)
  void initUpload_workspaceNotFound_returns404() throws Exception {
    given(initRawFileUploadService.init(any()))
        .willThrow(new WorkspaceNotFoundException("워크스페이스 없음"));

    mockMvc
        .perform(
            post("/api/v1/workspaces/999/datasets/uploads:init")
                .contentType(MediaType.APPLICATION_JSON)
                .content(INIT_BODY)
                .with(csrf()))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("WORKSPACE_NOT_FOUND"));
  }

  @Test
  @DisplayName("POST /uploads:init — sizeBytes 누락(0) → 400")
  @WithLongPrincipal(1L)
  void initUpload_invalidSize_returns400() throws Exception {
    String body =
        "{\"datasetKey\":\"k\",\"name\":\"n\",\"sourceType\":\"CRM\","
            + "\"filename\":\"d.zip\",\"contentType\":\"application/zip\",\"sizeBytes\":0}";

    mockMvc
        .perform(
            post("/api/v1/workspaces/1/datasets/uploads:init")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body)
                .with(csrf()))
        .andExpect(status().isBadRequest());
  }

  @Test
  @DisplayName("POST /uploads/{id}:complete — 성공 시 200과 PROCESSING 상태 반환")
  @WithLongPrincipal(1L)
  void completeUpload_returns200() throws Exception {
    given(completeRawFileUploadService.complete(any()))
        .willReturn(
            new CompleteRawFileUploadResult(
                42L, "test-key", 1L, "pending/key", 1024L, DatasetStatus.PROCESSING));

    mockMvc
        .perform(post("/api/v1/workspaces/1/datasets/uploads/42:complete").with(csrf()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.datasetId").value(42))
        .andExpect(jsonPath("$.status").value("PROCESSING"));
  }

  @Test
  @DisplayName("POST /uploads/{id}:complete — 데이터셋 없음 → 404")
  @WithLongPrincipal(1L)
  void completeUpload_datasetNotFound_returns404() throws Exception {
    given(completeRawFileUploadService.complete(any()))
        .willThrow(new DatasetNotFoundException("데이터셋 없음"));

    mockMvc
        .perform(post("/api/v1/workspaces/1/datasets/uploads/99:complete").with(csrf()))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("DATASET_NOT_FOUND"));
  }

  @Test
  @DisplayName("POST /uploads/{id}:complete — 비멤버 접근 → 403")
  @WithLongPrincipal(1L)
  void completeUpload_unauthorized_returns403() throws Exception {
    given(completeRawFileUploadService.complete(any()))
        .willThrow(new UnauthorizedWorkspaceAccessException("접근 권한 없음"));

    mockMvc
        .perform(post("/api/v1/workspaces/1/datasets/uploads/42:complete").with(csrf()))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("POST /uploads/{id}:complete — 객체 없음/상태 불일치 → 400")
  @WithLongPrincipal(1L)
  void completeUpload_invalidState_returns400() throws Exception {
    given(completeRawFileUploadService.complete(any()))
        .willThrow(new InvalidUploadStateException("업로드된 객체를 찾을 수 없습니다."));

    mockMvc
        .perform(post("/api/v1/workspaces/1/datasets/uploads/42:complete").with(csrf()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
  }
}
