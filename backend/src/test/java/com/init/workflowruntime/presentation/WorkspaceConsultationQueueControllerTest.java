package com.init.workflowruntime.presentation;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import com.init.workflowruntime.application.ConsultationService;
import com.init.workflowruntime.application.dto.ChatSessionResponse;
import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    value = WorkspaceConsultationQueueController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class WorkspaceConsultationQueueControllerTest {

  @Autowired private MockMvc mockMvc;

  @SuppressWarnings("removal")
  @MockBean
  private ConsultationService consultationService;

  @Test
  @DisplayName("GET /api/v1/workspaces/{workspaceId}/consultation/queue - 대기열 조회 성공")
  void should_returnWorkspaceQueue_when_memberRequests() throws Exception {
    ChatSessionResponse response = new ChatSessionResponse();
    response.setId(1L);
    response.setStatus("OPEN");
    response.setChannel("카카오톡");
    response.setStartedAt(OffsetDateTime.now());

    given(consultationService.getActiveQueue(2L, 7L)).willReturn(List.of(response));

    mockMvc
        .perform(
            get("/api/v1/workspaces/2/consultation/queue")
                .principal(new TestingAuthenticationToken(7L, null, Collections.emptyList())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value(1))
        .andExpect(jsonPath("$[0].channel").value("카카오톡"));
  }
}
