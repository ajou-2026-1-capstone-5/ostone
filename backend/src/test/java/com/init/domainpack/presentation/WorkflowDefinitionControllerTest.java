package com.init.domainpack.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.domainpack.application.GetWorkflowDefinitionListUseCase;
import com.init.domainpack.application.GetWorkflowDefinitionUseCase;
import com.init.domainpack.application.GetWorkflowTransitionUseCase;
import com.init.domainpack.application.UpdateWorkflowUseCase;
import com.init.domainpack.application.WorkflowDefinitionDetail;
import com.init.domainpack.application.WorkflowDefinitionSummary;
import com.init.domainpack.application.WorkflowTransitionDetail;
import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.application.exception.WorkflowDefinitionNotFoundException;
import com.init.domainpack.application.exception.WorkflowGraphJsonInvalidException;
import com.init.domainpack.application.exception.WorkflowTransitionNotFoundException;
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
  @MockitoBean private GetWorkflowTransitionUseCase transitionUseCase;

  @Test
  @DisplayName("GET .../workflows → 200 OK, 목록 반환")
  @WithLongPrincipal(10L)
  void should_200목록반환_when_정상조회() throws Exception {
    given(listUseCase.execute(any()))
        .willReturn(
            List.of(
                new WorkflowDefinitionSummary(
                    1L,
                    101L,
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
        .andExpect(jsonPath("$[0].domainPackVersionId").value(101))
        .andExpect(jsonPath("$[0].workflowCode").value("refund_flow"))
        .andExpect(jsonPath("$[0].name").value("환불 플로우"))
        .andExpect(jsonPath("$[0].graphJson").doesNotExist());
  }

  @Test
  @DisplayName("GET .../workflows/{id} → 200 OK, graphJson 포함")
  @WithLongPrincipal(10L)
  void should_200graphJson포함반환_when_단건정상조회() throws Exception {
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
  void should_200빈배열반환_when_workflow없음() throws Exception {
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
  void should_404반환_when_workflow미존재() throws Exception {
    given(detailUseCase.execute(any())).willThrow(new WorkflowDefinitionNotFoundException(99L));

    mockMvc
        .perform(get(BASE_URL + "/99"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("WORKFLOW_DEFINITION_NOT_FOUND"));
  }

  @Test
  @DisplayName("GET .../workflows → 403 권한 없음")
  @WithLongPrincipal(10L)
  void should_403반환_when_권한없음() throws Exception {
    given(listUseCase.execute(any()))
        .willThrow(new DomainPackUnauthorizedWorkspaceAccessException("워크스페이스에 접근 권한이 없습니다."));

    mockMvc
        .perform(get(BASE_URL))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("GET .../workflows → 401 미인증")
  void should_401반환_when_미인증() throws Exception {
    mockMvc.perform(get(BASE_URL)).andExpect(status().isUnauthorized());
  }

  @Test
  @DisplayName("GET .../workflows → 404 version 소속 불일치")
  @WithLongPrincipal(10L)
  void should_404반환_when_version소속불일치() throws Exception {
    given(listUseCase.execute(any())).willThrow(new DomainPackVersionNotFoundException(101L));

    mockMvc
        .perform(get(BASE_URL))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("DOMAIN_PACK_VERSION_NOT_FOUND"));
  }

  @Test
  @DisplayName("GET .../workflows/{id}/transitions/{transitionId} → 200 전 필드 검증")
  @WithLongPrincipal(10L)
  void should_200반환_when_transition정상조회() throws Exception {
    given(transitionUseCase.execute(any()))
        .willReturn(
            new WorkflowTransitionDetail(
                "e_check_to_answer", 1L, 101L, "check_refund_policy", "answer_refund", "eligible"));

    mockMvc
        .perform(get(BASE_URL + "/1/transitions/e_check_to_answer"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value("e_check_to_answer"))
        .andExpect(jsonPath("$.workflowDefinitionId").value(1))
        .andExpect(jsonPath("$.domainPackVersionId").value(101))
        .andExpect(jsonPath("$.from").value("check_refund_policy"))
        .andExpect(jsonPath("$.to").value("answer_refund"))
        .andExpect(jsonPath("$.label").value("eligible"));
  }

  @Test
  @DisplayName("GET .../workflows/{id}/transitions/{transitionId} → 404 transition 미존재")
  @WithLongPrincipal(10L)
  void should_404반환_when_transition미존재() throws Exception {
    given(transitionUseCase.execute(any()))
        .willThrow(new WorkflowTransitionNotFoundException("e_missing"));

    mockMvc
        .perform(get(BASE_URL + "/1/transitions/e_missing"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("WORKFLOW_TRANSITION_NOT_FOUND"));
  }

  @Test
  @DisplayName("GET .../workflows/{id}/transitions/{transitionId} → 404 workflow 미존재")
  @WithLongPrincipal(10L)
  void should_404반환_when_workflow미존재_transition조회() throws Exception {
    given(transitionUseCase.execute(any())).willThrow(new WorkflowDefinitionNotFoundException(99L));

    mockMvc
        .perform(get(BASE_URL + "/99/transitions/e_any"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("WORKFLOW_DEFINITION_NOT_FOUND"));
  }

  @Test
  @DisplayName("GET .../workflows/{id}/transitions/{transitionId} → 500 graphJson 파싱 오류")
  @WithLongPrincipal(10L)
  void should_500반환_when_graphJson파싱오류() throws Exception {
    given(transitionUseCase.execute(any()))
        .willThrow(new WorkflowGraphJsonInvalidException(1L, new RuntimeException("bad json")));

    mockMvc
        .perform(get(BASE_URL + "/1/transitions/e_any"))
        .andExpect(status().isInternalServerError())
        .andExpect(jsonPath("$.code").value("WORKFLOW_GRAPH_JSON_INVALID"));
  }

  @Test
  @DisplayName("GET .../workflows/{id}/transitions/{transitionId} → 403 권한 없음")
  @WithLongPrincipal(10L)
  void should_403반환_when_권한없음_transition() throws Exception {
    given(transitionUseCase.execute(any()))
        .willThrow(new DomainPackUnauthorizedWorkspaceAccessException("접근 권한이 없습니다."));

    mockMvc
        .perform(get(BASE_URL + "/1/transitions/e_any"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("GET .../workflows/{id}/transitions/{transitionId} → 401 미인증")
  void should_401반환_when_미인증_transition() throws Exception {
    mockMvc.perform(get(BASE_URL + "/1/transitions/e_any")).andExpect(status().isUnauthorized());
  }

  @Test
  @DisplayName("GET .../workflows/{id}/transitions/{transitionId} → 404 version 미존재")
  @WithLongPrincipal(10L)
  void should_404반환_when_version미존재_transition() throws Exception {
    given(transitionUseCase.execute(any())).willThrow(new DomainPackVersionNotFoundException(101L));

    mockMvc
        .perform(get(BASE_URL + "/1/transitions/e_any"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("DOMAIN_PACK_VERSION_NOT_FOUND"));
  }
}
