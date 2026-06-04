package com.init.workflowruntime.presentation;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import com.init.workflowruntime.application.SimulationService;
import com.init.workflowruntime.application.command.CreateSimulationFeedbackCommand;
import com.init.workflowruntime.application.command.CreateSimulationSessionCommand;
import com.init.workflowruntime.application.command.SendSimulationMessageCommand;
import com.init.workflowruntime.application.dto.ChatSessionResponse;
import com.init.workflowruntime.application.dto.SimulationFeedbackSessionResponse;
import com.init.workflowruntime.application.dto.SimulationSessionDetailResponse;
import com.init.workflowruntime.application.dto.SimulationSessionPageResponse;
import com.init.workflowruntime.domain.SimulationFeedbackSeverity;
import com.init.workflowruntime.domain.SimulationFeedbackType;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
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
    value = SimulationController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class SimulationControllerTest {

  @Autowired private MockMvc mockMvc;

  @MockitoBean private SimulationService simulationService;

  @Test
  @DisplayName("POST /api/v1/workspaces/{workspaceId}/simulation/sessions - 생성 요청 위임")
  void should_createSimulationSession() throws Exception {
    ChatSessionResponse session = simulationSession(55L);
    given(
            simulationService.createSession(
                new CreateSimulationSessionCommand(10L, 7L, "테스트 고객", null, 501L)))
        .willReturn(
            new SimulationSessionDetailResponse(
                session, List.of(), null, null, List.of(), emptyFeedback()));

    mockMvc
        .perform(
            post("/api/v1/workspaces/10/simulation/sessions")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"customerName\":\"테스트 고객\",\"workflowDefinitionId\":501}")
                .principal(auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.session.id").value(55))
        .andExpect(jsonPath("$.session.channel").value("SIMULATION"));
  }

  @Test
  @DisplayName("GET /api/v1/workspaces/{workspaceId}/simulation/sessions - 목록 반환")
  void should_listSimulationSessions() throws Exception {
    given(simulationService.listSessions(10L, 7L, 0, 20))
        .willReturn(
            new SimulationSessionPageResponse(List.of(simulationSession(55L)), 0, 20, 1, 1));

    mockMvc
        .perform(get("/api/v1/workspaces/10/simulation/sessions").principal(auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].id").value(55))
        .andExpect(jsonPath("$.content[0].channel").value("SIMULATION"));
  }

  @Test
  @DisplayName(
      "POST /api/v1/workspaces/{workspaceId}/simulation/sessions/{sessionId}/messages - 메시지 요청 위임")
  void should_sendSimulationMessage() throws Exception {
    ChatSessionResponse session = simulationSession(55L);
    given(
            simulationService.sendMessage(
                new SendSimulationMessageCommand(10L, 55L, 7L, "환불 상태 알려주세요")))
        .willReturn(
            new SimulationSessionDetailResponse(
                session, List.of(), null, null, List.of(), emptyFeedback()));

    mockMvc
        .perform(
            post("/api/v1/workspaces/10/simulation/sessions/55/messages")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"환불 상태 알려주세요\"}")
                .principal(auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.session.id").value(55));
  }

  @Test
  @DisplayName(
      "POST /api/v1/workspaces/{workspaceId}/simulation/sessions/{sessionId}/feedback - 피드백 요청 위임")
  void shouldCreateSimulationFeedback() throws Exception {
    ChatSessionResponse session = simulationSession(55L);
    given(
            simulationService.createFeedback(
                new CreateSimulationFeedbackCommand(
                    10L,
                    55L,
                    7L,
                    2L,
                    SimulationFeedbackType.MISSING_SLOT_QUESTION,
                    "주문번호를 묻지 않았습니다.",
                    "주문번호를 먼저 요청합니다.",
                    SimulationFeedbackSeverity.HIGH)))
        .willReturn(
            new SimulationSessionDetailResponse(
                session, List.of(), null, null, List.of(), emptyFeedback()));

    mockMvc
        .perform(
            post("/api/v1/workspaces/10/simulation/sessions/55/feedback")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "chatMessageId": 2,
                      "feedbackType": "MISSING_SLOT_QUESTION",
                      "description": "주문번호를 묻지 않았습니다.",
                      "expectedBehavior": "주문번호를 먼저 요청합니다.",
                      "severity": "HIGH"
                    }
                    """)
                .principal(auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.session.id").value(55));
  }

  private UsernamePasswordAuthenticationToken auth() {
    return new UsernamePasswordAuthenticationToken(
        7L, null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
  }

  private ChatSessionResponse simulationSession(Long id) {
    ChatSessionResponse response = new ChatSessionResponse();
    response.setId(id);
    response.setStatus("OPEN");
    response.setChannel("SIMULATION");
    response.setMetaJson("{\"simulation\":true}");
    response.setResponseMode("AI_ACTIVE");
    return response;
  }

  private SimulationFeedbackSessionResponse emptyFeedback() {
    return new SimulationFeedbackSessionResponse(List.of(), Map.of());
  }
}
