package com.init.workflowruntime.presentation;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import com.init.workflowruntime.application.SimulationService;
import com.init.workflowruntime.application.dto.SimulationFeedbackPageResponse;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    value = SimulationFeedbackController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class SimulationFeedbackControllerTest {

  @Autowired private MockMvc mockMvc;

  @MockitoBean private SimulationService simulationService;

  @Test
  @DisplayName("GET /api/v1/workspaces/{workspaceId}/simulation/feedback - 상태별 목록 반환")
  void shouldListSimulationFeedback() throws Exception {
    given(simulationService.listFeedback(10L, 7L, "OPEN", 0, 20))
        .willReturn(new SimulationFeedbackPageResponse(List.of(), 0, 20, 0, 0));

    mockMvc
        .perform(
            get("/api/v1/workspaces/10/simulation/feedback")
                .param("status", "OPEN")
                .principal(auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.page").value(0))
        .andExpect(jsonPath("$.content").isArray());
  }

  private UsernamePasswordAuthenticationToken auth() {
    return new UsernamePasswordAuthenticationToken(
        7L, null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
  }
}
