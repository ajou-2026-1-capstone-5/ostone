package com.init.workflowruntime.presentation;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import com.init.workflowruntime.application.SimulationImprovementCandidateService;
import com.init.workflowruntime.application.command.CreateSimulationImprovementCandidateCommand;
import com.init.workflowruntime.application.command.UpdateSimulationImprovementCandidateStatusCommand;
import com.init.workflowruntime.application.dto.SimulationImprovementCandidatePageResponse;
import com.init.workflowruntime.application.dto.SimulationImprovementCandidateResponse;
import com.init.workflowruntime.domain.SimulationImprovementCandidateStatus;
import com.init.workflowruntime.domain.SimulationImprovementCandidateTargetType;
import com.init.workflowruntime.domain.SimulationImprovementCandidateType;
import java.util.List;
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
    value = SimulationImprovementCandidateController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class SimulationImprovementCandidateControllerTest {

  @Autowired private MockMvc mockMvc;

  @MockitoBean private SimulationImprovementCandidateService candidateService;

  @Test
  @DisplayName(
      "POST /api/v1/workspaces/{workspaceId}/simulation/improvement-candidates/from-feedback/{feedbackId} - 후보 생성")
  void shouldCreateCandidateFromFeedback() throws Exception {
    given(
            candidateService.createFromFeedback(
                eq(
                    new CreateSimulationImprovementCandidateCommand(
                        10L, 7L, 900L, "SLOT", 300L, "order_number", "질문 없음", "질문 추가"))))
        .willReturn(response(1000L));

    mockMvc
        .perform(
            post("/api/v1/workspaces/10/simulation/improvement-candidates/from-feedback/900")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "targetElementType": "SLOT",
                      "targetElementId": 300,
                      "targetElementKey": "order_number",
                      "beforeSummary": "질문 없음",
                      "afterSummary": "질문 추가"
                    }
                    """)
                .principal(auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(1000))
        .andExpect(jsonPath("$.status").value("DRAFT"));
  }

  @Test
  @DisplayName("GET /api/v1/workspaces/{workspaceId}/simulation/improvement-candidates - 상태별 목록 반환")
  void shouldListCandidates() throws Exception {
    given(candidateService.listCandidates(10L, 7L, "DRAFT", 0, 20))
        .willReturn(
            new SimulationImprovementCandidatePageResponse(List.of(response(1000L)), 0, 20, 1, 1));

    mockMvc
        .perform(
            get("/api/v1/workspaces/10/simulation/improvement-candidates")
                .param("status", "DRAFT")
                .principal(auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].id").value(1000))
        .andExpect(jsonPath("$.page").value(0));
  }

  @Test
  @DisplayName(
      "GET /api/v1/workspaces/{workspaceId}/simulation/improvement-candidates/{candidateId} - 상세 반환")
  void shouldGetCandidate() throws Exception {
    given(candidateService.getCandidate(10L, 7L, 1000L)).willReturn(response(1000L));

    mockMvc
        .perform(
            get("/api/v1/workspaces/10/simulation/improvement-candidates/1000").principal(auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(1000))
        .andExpect(jsonPath("$.feedbackId").value(900));
  }

  @Test
  @DisplayName(
      "PATCH /api/v1/workspaces/{workspaceId}/simulation/improvement-candidates/{candidateId}/status - 상태 변경")
  void shouldUpdateStatus() throws Exception {
    given(
            candidateService.updateStatus(
                eq(
                    new UpdateSimulationImprovementCandidateStatusCommand(
                        10L, 7L, 1000L, "READY_FOR_REVIEW"))))
        .willReturn(
            new SimulationImprovementCandidateResponse(
                1000L,
                10L,
                101L,
                900L,
                55L,
                2L,
                SimulationImprovementCandidateType.SLOT_QUESTION,
                SimulationImprovementCandidateTargetType.SLOT,
                300L,
                "order_number",
                "질문 없음",
                "질문 추가",
                "feedback #900",
                null,
                null,
                null,
                "{}",
                null,
                null,
                null,
                SimulationImprovementCandidateStatus.READY_FOR_REVIEW,
                7L,
                null,
                null));

    mockMvc
        .perform(
            patch("/api/v1/workspaces/10/simulation/improvement-candidates/1000/status")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"READY_FOR_REVIEW\"}")
                .principal(auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("READY_FOR_REVIEW"));
  }

  @Test
  @DisplayName("POST 후보 생성: 빈 body도 허용한다")
  void shouldCreateCandidateWithEmptyBody() throws Exception {
    given(
            candidateService.createFromFeedback(
                eq(
                    new CreateSimulationImprovementCandidateCommand(
                        10L, 7L, 900L, null, null, null, null, null))))
        .willReturn(response(1000L));

    mockMvc
        .perform(
            post("/api/v1/workspaces/10/simulation/improvement-candidates/from-feedback/900")
                .principal(auth()))
        .andExpect(status().isOk());

    verify(candidateService)
        .createFromFeedback(
            new CreateSimulationImprovementCandidateCommand(
                10L, 7L, 900L, null, null, null, null, null));
  }

  private SimulationImprovementCandidateResponse response(Long candidateId) {
    return new SimulationImprovementCandidateResponse(
        candidateId,
        10L,
        101L,
        900L,
        55L,
        2L,
        SimulationImprovementCandidateType.SLOT_QUESTION,
        SimulationImprovementCandidateTargetType.SLOT,
        300L,
        "order_number",
        "질문 없음",
        "질문 추가",
        "feedback #900",
        null,
        null,
        null,
        "{}",
        null,
        null,
        null,
        SimulationImprovementCandidateStatus.DRAFT,
        7L,
        null,
        null);
  }

  private UsernamePasswordAuthenticationToken auth() {
    return new UsernamePasswordAuthenticationToken(
        7L, null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
  }
}
