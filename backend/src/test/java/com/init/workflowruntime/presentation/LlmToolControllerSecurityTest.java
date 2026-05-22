package com.init.workflowruntime.presentation;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.auth.application.JwtService;
import com.init.shared.infrastructure.security.ApiAuthenticationEntryPoint;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import com.init.shared.infrastructure.security.SecurityConfig;
import com.init.workflowruntime.application.LlmToolService;
import com.init.workflowruntime.application.command.GetCurrentWorkflowCommand;
import com.init.workflowruntime.application.command.GetLlmToolContextCommand;
import com.init.workflowruntime.application.dto.LlmToolContextResponse;
import com.init.workflowruntime.application.dto.LlmToolWorkflowResponse;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(LlmToolController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, ApiAuthenticationEntryPoint.class})
@TestPropertySource(properties = "cors.allowed-origins=http://localhost:5173")
@DisplayName("LlmToolController security")
class LlmToolControllerSecurityTest {

  @Autowired private MockMvc mockMvc;

  @Autowired private ObjectMapper objectMapper;

  @MockitoBean private LlmToolService llmToolService;

  @MockitoBean private JwtService jwtService;

  @Test
  @DisplayName("인증되지 않은 요청이면 401")
  void should_return401_when_unauthenticated() throws Exception {
    mockMvc
        .perform(get("/api/v1/llm-tools/sessions/1/context"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  @WithMockUser(roles = "USER")
  @DisplayName("ROLE_OPERATOR가 없으면 403")
  void should_return403_when_userIsNotOperator() throws Exception {
    mockMvc.perform(get("/api/v1/llm-tools/sessions/1/context")).andExpect(status().isForbidden());
  }

  @Test
  @WithMockUser(roles = "USER")
  @DisplayName("/workflow 경로에서 ROLE_OPERATOR가 없으면 403")
  void should_return403_when_userIsNotOperator_forWorkflow() throws Exception {
    mockMvc.perform(get("/api/v1/llm-tools/sessions/1/workflow")).andExpect(status().isForbidden());
  }

  @Test
  @WithMockUser(roles = "OPERATOR")
  @DisplayName("/workflow 경로에서 ROLE_OPERATOR면 200")
  void should_return200_when_userIsOperator_forWorkflow() throws Exception {
    given(llmToolService.getCurrentWorkflow(new GetCurrentWorkflowCommand(1L)))
        .willReturn(
            new LlmToolWorkflowResponse(
                1L, 10L, 101L, null, null, null, null, null, null, null, null, null, null));

    mockMvc.perform(get("/api/v1/llm-tools/sessions/1/workflow")).andExpect(status().isOk());
  }

  @Test
  @WithMockUser(roles = "OPERATOR")
  @DisplayName("ROLE_OPERATOR면 200")
  void should_return200_when_userIsOperator() throws Exception {
    given(llmToolService.getContext(new GetLlmToolContextCommand(1L)))
        .willReturn(
            new LlmToolContextResponse(
                1L,
                10L,
                101L,
                null,
                null,
                null,
                objectMapper.readTree("{}"),
                List.of(),
                List.of()));

    mockMvc.perform(get("/api/v1/llm-tools/sessions/1/context")).andExpect(status().isOk());
  }
}
