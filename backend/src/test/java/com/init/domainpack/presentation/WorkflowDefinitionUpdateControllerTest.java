package com.init.domainpack.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.domainpack.application.GetWorkflowDefinitionListUseCase;
import com.init.domainpack.application.GetWorkflowDefinitionUseCase;
import com.init.domainpack.application.UpdateWorkflowUseCase;
import com.init.domainpack.application.WorkflowDefinitionDetail;
import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.fixtures.WithLongPrincipal;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    value = WorkflowDefinitionController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@DisplayName("WorkflowDefinitionController PATCH /{workflowId}")
class WorkflowDefinitionUpdateControllerTest {

  private static final String BASE_URL =
      "/api/v1/workspaces/1/domain-packs/7/versions/10/workflows/99";

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @MockitoBean private GetWorkflowDefinitionListUseCase listUseCase;
  @MockitoBean private GetWorkflowDefinitionUseCase detailUseCase;
  @MockitoBean private UpdateWorkflowUseCase updateUseCase;

  @Test
  @DisplayName("유효한 요청 시 200 OK + WorkflowDefinitionDetail 반환")
  @WithLongPrincipal(5L)
  void should_200OK_when_유효한요청() throws Exception {
    given(updateUseCase.execute(any())).willReturn(sampleDetail());

    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRequestBody()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(99))
        .andExpect(jsonPath("$.name").value("수정된 이름"))
        .andExpect(jsonPath("$.workflowCode").value("wf_refund"));
  }

  @Test
  @DisplayName("name 누락 시 400 VALIDATION_ERROR")
  @WithLongPrincipal(5L)
  void should_400_when_name누락() throws Exception {
    ObjectNode body = objectMapper.createObjectNode();
    body.set(
        "graphJson", objectMapper.readTree("{\"direction\":\"LR\",\"nodes\":[],\"edges\":[]}"));

    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

    verifyNoInteractions(updateUseCase);
  }

  @Test
  @DisplayName("name이 빈 값이면 400 VALIDATION_ERROR")
  @WithLongPrincipal(5L)
  void should_400_when_nameBlank() throws Exception {
    ObjectNode body = objectMapper.createObjectNode();
    body.put("name", "");
    body.set(
        "graphJson", objectMapper.readTree("{\"direction\":\"LR\",\"nodes\":[],\"edges\":[]}"));

    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

    verifyNoInteractions(updateUseCase);
  }

  @Test
  @DisplayName("graphJson 누락 시 400 VALIDATION_ERROR")
  @WithLongPrincipal(5L)
  void should_400_when_graphJson누락() throws Exception {
    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"이름\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

    verifyNoInteractions(updateUseCase);
  }

  @Test
  @DisplayName("DRAFT 아닌 버전 → 400 WORKFLOW_NOT_EDITABLE")
  @WithLongPrincipal(5L)
  void should_400_when_PUBLISHED버전() throws Exception {
    given(updateUseCase.execute(any()))
        .willThrow(new BadRequestException("WORKFLOW_NOT_EDITABLE", "DRAFT 상태의 버전에서만 수정할 수 있습니다."));

    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRequestBody()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("WORKFLOW_NOT_EDITABLE"));
  }

  @Test
  @DisplayName("존재하지 않는 workflowId → 404")
  @WithLongPrincipal(5L)
  void should_404_when_workflowNotFound() throws Exception {
    given(updateUseCase.execute(any()))
        .willThrow(new NotFoundException("NOT_FOUND", "워크플로우를 찾을 수 없습니다: 99"));

    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRequestBody()))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("권한 없는 사용자 → 403")
  @WithLongPrincipal(5L)
  void should_403_when_권한없음() throws Exception {
    given(updateUseCase.execute(any()))
        .willThrow(new DomainPackUnauthorizedWorkspaceAccessException("접근 권한이 없습니다."));

    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRequestBody()))
        .andExpect(status().isForbidden());
  }

  @Test
  @DisplayName("인증 없는 요청 → 401")
  void should_401_when_인증없음() throws Exception {
    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRequestBody()))
        .andExpect(status().isUnauthorized());

    verifyNoInteractions(updateUseCase);
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private String validRequestBody() throws Exception {
    ObjectNode graphJson = objectMapper.createObjectNode();
    graphJson.put("direction", "LR");
    graphJson.set(
        "nodes",
        objectMapper.readTree(
            "[{\"id\":\"start\",\"type\":\"START\"},{\"id\":\"end\",\"type\":\"TERMINAL\"}]"));
    graphJson.set(
        "edges", objectMapper.readTree("[{\"from\":\"start\",\"to\":\"end\",\"label\":null}]"));

    ObjectNode body = objectMapper.createObjectNode();
    body.put("name", "수정된 이름");
    body.set("graphJson", graphJson);
    return objectMapper.writeValueAsString(body);
  }

  private WorkflowDefinitionDetail sampleDetail() {
    return new WorkflowDefinitionDetail(
        99L,
        "wf_refund",
        "수정된 이름",
        null,
        "{\"direction\":\"LR\",\"nodes\":[],\"edges\":[]}",
        "start",
        "[\"end\"]",
        "[]",
        "{}",
        OffsetDateTime.parse("2026-04-14T10:00:00Z"),
        OffsetDateTime.parse("2026-04-15T12:00:00Z"));
  }
}
