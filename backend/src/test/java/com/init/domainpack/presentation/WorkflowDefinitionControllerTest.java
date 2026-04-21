package com.init.domainpack.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.domainpack.application.GetWorkflowDefinitionListUseCase;
import com.init.domainpack.application.GetWorkflowDefinitionUseCase;
import com.init.domainpack.application.UpdateWorkflowUseCase;
import com.init.domainpack.application.WorkflowDefinitionDetail;
import com.init.domainpack.application.WorkflowDefinitionSummary;
import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.application.exception.WorkflowDefinitionNotFoundException;
import com.init.fixtures.WithLongPrincipal;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    value = WorkflowDefinitionController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@DisplayName("WorkflowDefinitionController")
class WorkflowDefinitionControllerTest {

  private static final String BASE_URL =
      "/api/v1/workspaces/1/domain-packs/7/versions/101/workflows";

  @Autowired private MockMvc mockMvc;

  @MockitoBean private GetWorkflowDefinitionListUseCase listUseCase;
  @MockitoBean private GetWorkflowDefinitionUseCase detailUseCase;
  @MockitoBean private UpdateWorkflowUseCase updateUseCase;

  @Test
  @DisplayName("GET .../workflows → 200 OK, 목록 반환")
  @WithLongPrincipal(10L)
  void listWorkflows_returnsOk() throws Exception {
    given(listUseCase.execute(any()))
        .willReturn(
            List.of(
                new WorkflowDefinitionSummary(
                    1L,
                    10L,
                    "refund_flow",
                    "환불 플로우",
                    null,
                    "start",
                    "[\"terminal\"]",
                    OffsetDateTime.parse("2026-04-14T10:00:00Z"),
                    OffsetDateTime.parse("2026-04-14T10:00:00Z"))));

    mockMvc
        .perform(get(BASE_URL))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].domainPackVersionId").value(10))
        .andExpect(jsonPath("$[0].workflowCode").value("refund_flow"))
        .andExpect(jsonPath("$[0].name").value("환불 플로우"))
        .andExpect(jsonPath("$[0].graphJson").doesNotExist());
  }

  @Test
  @DisplayName("GET .../workflows/{id} → 200 OK, graphJson 포함")
  @WithLongPrincipal(10L)
  void getWorkflow_returnsOkWithGraphJson() throws Exception {
    given(detailUseCase.execute(any()))
        .willReturn(
            new WorkflowDefinitionDetail(
                1L,
                "refund_flow",
                "환불 플로우",
                null,
                "{\"direction\":\"LR\",\"nodes\":[],\"edges\":[]}",
                "start",
                "[\"terminal\"]",
                "[]",
                "{}",
                OffsetDateTime.parse("2026-04-14T10:00:00Z"),
                OffsetDateTime.parse("2026-04-14T10:00:00Z")));

    mockMvc
        .perform(get(BASE_URL + "/1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.workflowCode").value("refund_flow"))
        .andExpect(jsonPath("$.graphJson.direction").value("LR"))
        .andExpect(jsonPath("$.graphJson.nodes").isArray())
        .andExpect(jsonPath("$.graphJson.edges").isArray());
  }

  @Test
  @DisplayName("GET .../workflows → workflow 없으면 빈 배열")
  @WithLongPrincipal(10L)
  void listWorkflows_noWorkflows_returnsEmptyArray() throws Exception {
    given(listUseCase.execute(any())).willReturn(List.of());

    mockMvc
        .perform(get(BASE_URL))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$").isArray())
        .andExpect(jsonPath("$").isEmpty());
  }

  @Test
  @DisplayName("GET .../workflows/{id} → 404 미존재")
  @WithLongPrincipal(10L)
  void getWorkflow_notFound_returns404() throws Exception {
    given(detailUseCase.execute(any())).willThrow(new WorkflowDefinitionNotFoundException(99L));

    mockMvc
        .perform(get(BASE_URL + "/99"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("WORKFLOW_DEFINITION_NOT_FOUND"));
  }

  @Test
  @DisplayName("GET .../workflows → 403 권한 없음")
  @WithLongPrincipal(10L)
  void listWorkflows_unauthorized_returns403() throws Exception {
    given(listUseCase.execute(any()))
        .willThrow(new DomainPackUnauthorizedWorkspaceAccessException("워크스페이스에 접근 권한이 없습니다."));

    mockMvc
        .perform(get(BASE_URL))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("GET .../workflows → 401 미인증")
  void listWorkflows_unauthenticated_returns401() throws Exception {
    mockMvc.perform(get(BASE_URL)).andExpect(status().isUnauthorized());
  }

  @Test
  @DisplayName("GET .../workflows → 404 version 소속 불일치")
  @WithLongPrincipal(10L)
  void listWorkflows_versionNotInPack_returns404() throws Exception {
    given(listUseCase.execute(any())).willThrow(new DomainPackVersionNotFoundException(101L));

    mockMvc
        .perform(get(BASE_URL))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("DOMAIN_PACK_VERSION_NOT_FOUND"));
  }
}
