package com.init.corpus.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.corpus.application.DatasetUploadResult;
import com.init.corpus.application.DatasetUploadService;
import com.init.corpus.application.RawDatasetUploadService;
import com.init.corpus.application.exception.ConsultingContentParseException;
import com.init.corpus.application.exception.DatasetKeyConflictException;
import com.init.corpus.application.exception.DuplicateTurnIndexException;
import com.init.corpus.application.exception.UnauthorizedWorkspaceAccessException;
import com.init.corpus.application.exception.WorkspaceNotFoundException;
import com.init.corpus.domain.model.DatasetStatus;
import com.init.corpus.domain.model.PiiRedactionStatus;
import com.init.fixtures.Fixtures;
import com.init.fixtures.WithLongPrincipal;
import com.init.shared.application.exception.QuotaExceededException;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * NI-1 Option B 채택 (Assumption):
 *
 * <p>SecurityMockMvcRequestPostProcessors.authentication()은 Spring Security 6 + addFilters=false
 * 환경에서 동작하지 않아 {@link WithLongPrincipal} (@WithSecurityContext 기반) 어노테이션을 사용한다. 이 방식으로
 * SecurityContextHolder에 Long principal을 직접 주입한다.
 *
 * <p>SecurityConfig가 @WebMvcTest 스캔 대상이 아니므로 기본 Spring Security가 적용된다. CSRF가 활성화되어 있어 모든 POST 요청에
 * {@code .with(csrf())}를 명시한다.
 *
 * <p>401 테스트는 D-5 결정에 따라 제외.
 */
@WebMvcTest(
    value = DatasetController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
class RawDatasetUploadControllerTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @SuppressWarnings("removal")
  @MockBean
  private RawDatasetUploadService rawDatasetUploadService;

  @SuppressWarnings("removal")
  @MockBean
  private DatasetUploadService datasetUploadService;

  @SuppressWarnings("removal")
  @MockBean
  private com.init.corpus.application.InitRawFileUploadService initRawFileUploadService;

  @SuppressWarnings("removal")
  @MockBean
  private com.init.corpus.application.CompleteRawFileUploadService completeRawFileUploadService;

  private String validRequestBody() throws Exception {
    return objectMapper.writeValueAsString(
        Map.of(
            "datasetKey", "test-key",
            "name", "Test Dataset",
            "sourceType", "csv",
            "conversations",
                List.of(
                    Map.of(
                        "source_id",
                        "case-001",
                        "consulting_content",
                        Fixtures.validConsultingContent()))));
  }

  private String validStructuredRequestBody() throws Exception {
    return objectMapper.writeValueAsString(
        Map.of(
            "datasetKey",
            "structured-key",
            "name",
            "Structured Dataset",
            "sourceType",
            "csv",
            "conversations",
            List.of(
                Map.of(
                    "externalCaseId",
                    "case-001",
                    "channel",
                    "CRM",
                    "languageCode",
                    "ko",
                    "turns",
                    List.of(
                        Map.of(
                            "turnIndex",
                            0,
                            "speakerRole",
                            "CUSTOMER",
                            "messageText",
                            "주문 관련 문의입니다."))))));
  }

  @Test
  @DisplayName("유효한 요청 → 201 Created")
  @WithLongPrincipal(1L)
  void uploadRawDataset_success_returns201() throws Exception {
    DatasetUploadResult result =
        new DatasetUploadResult(
            1L, "test-key", 1L, DatasetStatus.READY, PiiRedactionStatus.PENDING, 1);
    given(rawDatasetUploadService.upload(any())).willReturn(result);

    mockMvc
        .perform(
            post("/api/v1/workspaces/1/datasets/raw")
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRequestBody())
                .with(csrf()))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.datasetId").value(1))
        .andExpect(jsonPath("$.datasetKey").value("test-key"));
  }

  @Test
  @DisplayName("파싱 실패 → 400 CONSULTING_CONTENT_PARSE_ERROR")
  @WithLongPrincipal(1L)
  void uploadRawDataset_parseFailure_returns400() throws Exception {
    given(rawDatasetUploadService.upload(any()))
        .willThrow(new ConsultingContentParseException("파싱 실패"));

    mockMvc
        .perform(
            post("/api/v1/workspaces/1/datasets/raw")
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRequestBody())
                .with(csrf()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("CONSULTING_CONTENT_PARSE_ERROR"));
  }

  @Test
  @DisplayName("데이터셋 키 충돌 → 409 DATASET_KEY_CONFLICT")
  @WithLongPrincipal(1L)
  void uploadRawDataset_datasetKeyConflict_returns409() throws Exception {
    given(rawDatasetUploadService.upload(any()))
        .willThrow(new DatasetKeyConflictException("이미 사용 중인 키"));

    mockMvc
        .perform(
            post("/api/v1/workspaces/1/datasets/raw")
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRequestBody())
                .with(csrf()))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("DATASET_KEY_CONFLICT"));
  }

  @Test
  @DisplayName("quota 초과 → 409 QUOTA_EXCEEDED")
  @WithLongPrincipal(1L)
  void uploadRawDataset_quotaExceeded_returns409() throws Exception {
    given(rawDatasetUploadService.upload(any()))
        .willThrow(new QuotaExceededException("DATASET_UPLOAD", 3, 3));

    mockMvc
        .perform(
            post("/api/v1/workspaces/1/datasets/raw")
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRequestBody())
                .with(csrf()))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("QUOTA_EXCEEDED"))
        .andExpect(jsonPath("$.resource").value("DATASET_UPLOAD"))
        .andExpect(jsonPath("$.limit").value(3))
        .andExpect(jsonPath("$.used").value(3));
  }

  @Test
  @DisplayName("구조화 dataset quota 초과 → 409 QUOTA_EXCEEDED")
  @WithLongPrincipal(1L)
  void uploadDataset_quotaExceeded_returns409() throws Exception {
    given(datasetUploadService.upload(any()))
        .willThrow(new QuotaExceededException("DATASET_UPLOAD", 3, 3));

    mockMvc
        .perform(
            post("/api/v1/workspaces/1/datasets")
                .contentType(MediaType.APPLICATION_JSON)
                .content(validStructuredRequestBody())
                .with(csrf()))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("QUOTA_EXCEEDED"))
        .andExpect(jsonPath("$.resource").value("DATASET_UPLOAD"))
        .andExpect(jsonPath("$.limit").value(3))
        .andExpect(jsonPath("$.used").value(3));
  }

  @Test
  @DisplayName("워크스페이스 없음 → 404 WORKSPACE_NOT_FOUND")
  @WithLongPrincipal(1L)
  void uploadRawDataset_workspaceNotFound_returns404() throws Exception {
    given(rawDatasetUploadService.upload(any()))
        .willThrow(new WorkspaceNotFoundException("워크스페이스 없음"));

    mockMvc
        .perform(
            post("/api/v1/workspaces/1/datasets/raw")
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRequestBody())
                .with(csrf()))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("WORKSPACE_NOT_FOUND"));
  }

  @Test
  @DisplayName("권한 없음 → 403 FORBIDDEN")
  @WithLongPrincipal(1L)
  void uploadRawDataset_unauthorized_returns403() throws Exception {
    given(rawDatasetUploadService.upload(any()))
        .willThrow(new UnauthorizedWorkspaceAccessException("접근 권한 없음"));

    mockMvc
        .perform(
            post("/api/v1/workspaces/1/datasets/raw")
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRequestBody())
                .with(csrf()))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("중복 턴 인덱스 → 400 DUPLICATE_TURN_INDEX")
  @WithLongPrincipal(1L)
  void uploadRawDataset_duplicateTurnIndex_returns400() throws Exception {
    given(rawDatasetUploadService.upload(any()))
        .willThrow(new DuplicateTurnIndexException("중복된 턴 인덱스"));

    mockMvc
        .perform(
            post("/api/v1/workspaces/1/datasets/raw")
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRequestBody())
                .with(csrf()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("DUPLICATE_TURN_INDEX"));
  }

  @Test
  @DisplayName("필수 필드 누락 → 400 VALIDATION_ERROR")
  @WithLongPrincipal(1L)
  void uploadRawDataset_missingRequiredField_returns400() throws Exception {
    String bodyWithoutDatasetKey =
        objectMapper.writeValueAsString(
            Map.of(
                "name", "Test Dataset",
                "sourceType", "csv",
                "conversations",
                    List.of(
                        Map.of(
                            "source_id",
                            "case-001",
                            "consulting_content",
                            Fixtures.validConsultingContent()))));

    mockMvc
        .perform(
            post("/api/v1/workspaces/1/datasets/raw")
                .contentType(MediaType.APPLICATION_JSON)
                .content(bodyWithoutDatasetKey)
                .with(csrf()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
  }
}
