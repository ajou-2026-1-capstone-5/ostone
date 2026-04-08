package com.init.workflowruntime.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import com.init.workflowruntime.application.ConsultationService;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.application.dto.ChatSessionResponse;
import com.init.workflowruntime.application.dto.SendMessageRequest;
import com.init.workflowruntime.application.dto.UpdateStatusRequest;
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
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    value = ConsultationController.class,
    excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = JwtAuthenticationFilter.class)
)
@AutoConfigureMockMvc(addFilters = false) // Disable spring security filters for simple controller test
class ConsultationControllerTest {

  @Autowired
  private MockMvc mockMvc;

  @Autowired
  private ObjectMapper objectMapper;

  @SuppressWarnings("removal")
  @MockBean
  private ConsultationService consultationService;

  @Test
  @DisplayName("GET /api/v1/consultation/queue - 대기열 조회 성공")
  void getActiveQueue_Success() throws Exception {
    // given
    ChatSessionResponse response = new ChatSessionResponse();
    response.setId(1L);
    response.setStatus("OPEN");
    response.setChannel("카카오톡");
    response.setStartedAt(OffsetDateTime.now());
    
    given(consultationService.getActiveQueue()).willReturn(List.of(response));

    // when & then
    mockMvc.perform(get("/api/v1/consultation/queue"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value(1))
        .andExpect(jsonPath("$[0].channel").value("카카오톡"));
  }

  @Test
  @DisplayName("GET /api/v1/consultation/sessions/{id}/messages - 메시지 조회 성공")
  void getMessages_Success() throws Exception {
    // given
    ChatMessageResponse msg = new ChatMessageResponse();
    msg.setId(1L);
    msg.setContent("Hello");
    msg.setSenderRole("CUSTOMER");
    
    given(consultationService.getMessages(1L)).willReturn(List.of(msg));

    // when & then
    mockMvc.perform(get("/api/v1/consultation/sessions/1/messages"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].content").value("Hello"));
  }

  @Test
  @DisplayName("POST /api/v1/consultation/sessions/{id}/messages - 메시지 전송 성공")
  void sendMessage_Success() throws Exception {
    // given
    SendMessageRequest request = new SendMessageRequest();
    request.setContent("Reply");
    request.setNote(false);

    ChatMessageResponse response = new ChatMessageResponse();
    response.setId(10L);
    response.setContent("Hello Operator");
    response.setSenderRole("AGENT");

    given(consultationService.sendMessage(eq(1L), any(SendMessageRequest.class))).willReturn(response);

    // when & then
    String content = objectMapper.writeValueAsString(request);
    MediaType contentType = MediaType.APPLICATION_JSON;

    mockMvc
        .perform(
            post("/api/v1/consultation/sessions/1/messages")
                .contentType(contentType)
                .content(content))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content").value("Hello Operator"))
        .andExpect(jsonPath("$.senderRole").value("AGENT"));
  }

  @Test
  @DisplayName("PATCH /api/v1/consultation/sessions/{id}/status - 상태 업데이트 성공")
  void updateStatus_Success() throws Exception {
    // given
    UpdateStatusRequest request = new UpdateStatusRequest();
    request.setStatus("COMPLETED");

    ChatSessionResponse response = new ChatSessionResponse();
    response.setId(1L);
    response.setStatus("RESOLVED");

    given(consultationService.updateSessionStatus(eq(1L), eq("COMPLETED"))).willReturn(response);

    // when & then
    String content = objectMapper.writeValueAsString(request);
    MediaType contentType = MediaType.APPLICATION_JSON;

    mockMvc
        .perform(
            patch("/api/v1/consultation/sessions/1/status")
                .contentType(contentType)
                .content(content))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("RESOLVED"));
  }
}
