package com.init.workflowruntime.presentation;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import com.init.workflowruntime.application.ConsultationMetricsService;
import com.init.workflowruntime.application.command.GetWorkspaceMetricsCommand;
import com.init.workflowruntime.application.dto.ConsultationMetricsResponse;
import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    value = ConsultationMetricsController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class ConsultationMetricsControllerTest {

  @Autowired private MockMvc mockMvc;

  @SuppressWarnings("removal")
  @MockBean
  private ConsultationMetricsService consultationMetricsService;

  @Test
  @DisplayName("GET /api/v1/workspaces/{workspaceId}/consultation/metrics - 멤버 조회 성공")
  void should_returnMetrics_when_workspaceMemberRequests() throws Exception {
    given(consultationMetricsService.getWorkspaceMetrics(new GetWorkspaceMetricsCommand(2L, 7L)))
        .willReturn(
            new ConsultationMetricsResponse(
                2L,
                OffsetDateTime.parse("2026-05-27T00:00:00+09:00"),
                OffsetDateTime.parse("2026-05-28T00:00:00+09:00"),
                20,
                14,
                134L,
                3L,
                420L,
                9,
                5,
                2,
                null,
                14,
                9,
                5));

    mockMvc
        .perform(get("/api/v1/workspaces/2/consultation/metrics").principal(auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.workspaceId").value(2))
        .andExpect(jsonPath("$.totalConsultationCount").value(20))
        .andExpect(jsonPath("$.completedConsultationCount").value(14))
        .andExpect(jsonPath("$.averageFirstResponseSeconds").value(134))
        .andExpect(jsonPath("$.averageLlmFirstResponseSeconds").value(3))
        .andExpect(jsonPath("$.averageHumanFirstResponseSeconds").value(420))
        .andExpect(jsonPath("$.llmHandledCount").value(9))
        .andExpect(jsonPath("$.humanInterventionCount").value(5))
        .andExpect(jsonPath("$.unresolvedSessionCount").value(2))
        .andExpect(jsonPath("$.handledTodayCount").value(14))
        .andExpect(jsonPath("$.llmHandledTodayCount").value(9))
        .andExpect(jsonPath("$.humanHandledTodayCount").value(5));
  }

  @Test
  @DisplayName("GET /api/v1/workspaces/{workspaceId}/consultation/metrics - 기간 파라미터 전달")
  void should_passPeriodToService_when_dateQueryParamsExist() throws Exception {
    given(
            consultationMetricsService.getWorkspaceMetrics(
                new GetWorkspaceMetricsCommand(
                    2L, 7L, LocalDate.parse("2026-05-21"), LocalDate.parse("2026-05-27"))))
        .willReturn(
            new ConsultationMetricsResponse(
                2L,
                OffsetDateTime.parse("2026-05-21T00:00:00+09:00"),
                OffsetDateTime.parse("2026-05-28T00:00:00+09:00"),
                8,
                6,
                90L,
                4L,
                300L,
                5,
                1,
                2,
                null,
                6,
                5,
                1));

    mockMvc
        .perform(
            get("/api/v1/workspaces/2/consultation/metrics")
                .queryParam("from", "2026-05-21")
                .queryParam("to", "2026-05-27")
                .principal(auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.periodStart").value("2026-05-21T00:00:00+09:00"))
        .andExpect(jsonPath("$.periodEnd").value("2026-05-28T00:00:00+09:00"))
        .andExpect(jsonPath("$.totalConsultationCount").value(8));
  }

  @Test
  @DisplayName("GET /api/v1/workspaces/{workspaceId}/consultation/metrics - 멤버 아님")
  void should_returnForbidden_when_userIsNotWorkspaceMember() throws Exception {
    given(consultationMetricsService.getWorkspaceMetrics(new GetWorkspaceMetricsCommand(2L, 7L)))
        .willThrow(new WorkspaceAccessDeniedException("워크스페이스에 접근 권한이 없습니다."));

    mockMvc
        .perform(get("/api/v1/workspaces/2/consultation/metrics").principal(auth()))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("WORKSPACE_ACCESS_DENIED"));
  }

  @Test
  @DisplayName("GET /api/v1/workspaces/{workspaceId}/consultation/metrics - 데이터 없음")
  void should_returnEmptyMetrics_when_workspaceHasNoData() throws Exception {
    given(consultationMetricsService.getWorkspaceMetrics(new GetWorkspaceMetricsCommand(2L, 7L)))
        .willReturn(
            new ConsultationMetricsResponse(
                2L,
                OffsetDateTime.parse("2026-05-27T00:00:00+09:00"),
                OffsetDateTime.parse("2026-05-28T00:00:00+09:00"),
                0,
                0,
                null,
                null,
                null,
                0,
                0,
                0,
                null,
                0,
                0,
                0));

    mockMvc
        .perform(get("/api/v1/workspaces/2/consultation/metrics").principal(auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.averageFirstResponseSeconds").isEmpty())
        .andExpect(jsonPath("$.averageLlmFirstResponseSeconds").isEmpty())
        .andExpect(jsonPath("$.averageHumanFirstResponseSeconds").isEmpty())
        .andExpect(jsonPath("$.handledTodayCount").value(0));
  }

  private UsernamePasswordAuthenticationToken auth() {
    return new UsernamePasswordAuthenticationToken(
        7L, null, List.of(new SimpleGrantedAuthority("ROLE_OPERATOR")));
  }
}
