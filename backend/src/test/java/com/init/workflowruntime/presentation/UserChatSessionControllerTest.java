package com.init.workflowruntime.presentation;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import com.init.workflowruntime.application.UserChatSessionService;
import com.init.workflowruntime.application.command.GetOrCreateCurrentSessionCommand;
import com.init.workflowruntime.application.dto.ChatSessionResponse;
import java.time.OffsetDateTime;
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
    value = UserChatSessionController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(addFilters = false)
class UserChatSessionControllerTest {

  @Autowired private MockMvc mockMvc;

  @MockitoBean private UserChatSessionService userChatSessionService;

  @Test
  @DisplayName("GET /api/v1/workspaces/{workspaceId}/chat/sessions/current - 현재 세션 반환")
  void should_returnCurrentSession() throws Exception {
    ChatSessionResponse response = new ChatSessionResponse();
    response.setId(33L);
    response.setStatus("OPEN");
    response.setChannel("WEB");
    response.setStartedAt(OffsetDateTime.parse("2026-05-26T10:00:00+09:00"));

    given(
            userChatSessionService.getOrCreateCurrentSession(
                new GetOrCreateCurrentSessionCommand(10L, 7L, "김민지")))
        .willReturn(response);

    UsernamePasswordAuthenticationToken authentication =
        new UsernamePasswordAuthenticationToken(
            7L, null, java.util.List.of(new SimpleGrantedAuthority("ROLE_USER")));

    mockMvc
        .perform(
            get("/api/v1/workspaces/10/chat/sessions/current")
                .param("customerName", "김민지")
                .principal(authentication))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(33))
        .andExpect(jsonPath("$.status").value("OPEN"))
        .andExpect(jsonPath("$.channel").value("WEB"));
  }
}
