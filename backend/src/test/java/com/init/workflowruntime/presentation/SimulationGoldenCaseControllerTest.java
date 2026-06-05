package com.init.workflowruntime.presentation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import com.init.workflowruntime.application.SimulationGoldenCaseService;
import com.init.workflowruntime.application.command.CreateSimulationGoldenCaseCommand;
import com.init.workflowruntime.application.command.ReplaySimulationGoldenCaseCommand;
import com.init.workflowruntime.application.dto.SimulationGoldenCasePageResponse;
import com.init.workflowruntime.application.dto.SimulationGoldenCaseReplayResultPageResponse;
import com.init.workflowruntime.application.dto.SimulationGoldenCaseReplayResultResponse;
import com.init.workflowruntime.application.dto.SimulationGoldenCaseResponse;
import com.init.workflowruntime.domain.SimulationGoldenCaseReplayStatus;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    value = SimulationGoldenCaseController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class SimulationGoldenCaseControllerTest {

  @Autowired private MockMvc mockMvc;

  @MockitoBean private SimulationGoldenCaseService goldenCaseService;

  @Test
  @DisplayName(
      "POST /api/v1/workspaces/{workspaceId}/simulation/sessions/{sessionId}/golden-cases - 검증 케이스 생성 요청 위임")
  void should_createGoldenCase() throws Exception {
    given(goldenCaseService.createFromSession(any(CreateSimulationGoldenCaseCommand.class)))
        .willReturn(goldenCaseResponse(null));

    mockMvc
        .perform(
            post("/api/v1/workspaces/10/simulation/sessions/55/golden-cases")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name": "환불 검증",
                      "expectedIntentCode": "refund_request",
                      "expectedWorkflowCode": "refund_workflow",
                      "expectedCurrentState": "collect_order_no",
                      "expectedActionType": "ASK_SLOT",
                      "expectedSlotValues": {"orderNo": "A-100"}
                    }
                    """)
                .principal(auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(900))
        .andExpect(jsonPath("$.name").value("환불 검증"));

    ArgumentCaptor<CreateSimulationGoldenCaseCommand> captor =
        ArgumentCaptor.forClass(CreateSimulationGoldenCaseCommand.class);
    verify(goldenCaseService).createFromSession(captor.capture());
    assertThat(captor.getValue().workspaceId()).isEqualTo(10L);
    assertThat(captor.getValue().sessionId()).isEqualTo(55L);
    assertThat(captor.getValue().userId()).isEqualTo(7L);
    assertThat(captor.getValue().expectedActionType()).isEqualTo("ASK_SLOT");
    assertThat(captor.getValue().expectedSlotValues().path("orderNo").asText()).isEqualTo("A-100");
  }

  @Test
  @DisplayName("GET /api/v1/workspaces/{workspaceId}/simulation/golden-cases - 목록 반환")
  void should_listGoldenCases() throws Exception {
    given(goldenCaseService.listGoldenCases(10L, 7L, 0, 20))
        .willReturn(
            new SimulationGoldenCasePageResponse(List.of(goldenCaseResponse(null)), 0, 20, 1, 1));

    mockMvc
        .perform(get("/api/v1/workspaces/10/simulation/golden-cases").principal(auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].id").value(900));
  }

  @Test
  @DisplayName(
      "POST /api/v1/workspaces/{workspaceId}/simulation/golden-cases/{goldenCaseId}/replays - replay 요청 위임")
  void should_replayGoldenCase() throws Exception {
    given(goldenCaseService.replay(any(ReplaySimulationGoldenCaseCommand.class)))
        .willReturn(replayResponse(SimulationGoldenCaseReplayStatus.PASS, null));

    mockMvc
        .perform(
            post("/api/v1/workspaces/10/simulation/golden-cases/900/replays")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"domainPackVersionId\":101}")
                .principal(auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("PASS"));

    ArgumentCaptor<ReplaySimulationGoldenCaseCommand> captor =
        ArgumentCaptor.forClass(ReplaySimulationGoldenCaseCommand.class);
    verify(goldenCaseService).replay(captor.capture());
    assertThat(captor.getValue().workspaceId()).isEqualTo(10L);
    assertThat(captor.getValue().goldenCaseId()).isEqualTo(900L);
    assertThat(captor.getValue().domainPackVersionId()).isEqualTo(101L);
    assertThat(captor.getValue().userId()).isEqualTo(7L);
  }

  @Test
  @DisplayName(
      "GET /api/v1/workspaces/{workspaceId}/simulation/golden-cases/{goldenCaseId}/replays - replay 결과 목록 반환")
  void should_listReplayResults() throws Exception {
    given(goldenCaseService.listReplayResults(10L, 7L, 900L, 0, 20))
        .willReturn(
            new SimulationGoldenCaseReplayResultPageResponse(
                List.of(replayResponse(SimulationGoldenCaseReplayStatus.FAIL, "state mismatch")),
                0,
                20,
                1,
                1));

    mockMvc
        .perform(get("/api/v1/workspaces/10/simulation/golden-cases/900/replays").principal(auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].status").value("FAIL"))
        .andExpect(jsonPath("$.content[0].failureSummary").value("state mismatch"));
  }

  private UsernamePasswordAuthenticationToken auth() {
    return new UsernamePasswordAuthenticationToken(
        7L, null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
  }

  private SimulationGoldenCaseResponse goldenCaseResponse(
      SimulationGoldenCaseReplayResultResponse latestReplayResult) {
    return new SimulationGoldenCaseResponse(
        900L,
        10L,
        55L,
        101L,
        "환불 검증",
        "[{\"content\":\"환불하고 싶어요\"}]",
        "{\"currentState\":\"collect_order_no\"}",
        7L,
        null,
        null,
        latestReplayResult);
  }

  private SimulationGoldenCaseReplayResultResponse replayResponse(
      SimulationGoldenCaseReplayStatus status, String failureSummary) {
    return new SimulationGoldenCaseReplayResultResponse(
        950L,
        10L,
        900L,
        101L,
        901L,
        status,
        "{\"currentState\":\"collect_order_no\"}",
        "{\"currentState\":\"collect_order_no\"}",
        failureSummary,
        7L,
        null);
  }
}
