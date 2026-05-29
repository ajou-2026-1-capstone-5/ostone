package com.init.workflowruntime.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import com.init.workflowruntime.application.ConsultationService;
import com.init.workflowruntime.application.LlmToolService;
import com.init.workflowruntime.application.command.GetCurrentWorkflowCommand;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.application.dto.ChatSessionResponse;
import com.init.workflowruntime.application.dto.LlmToolWorkflowResponse;
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
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(
    addFilters = false) // Disable spring security filters for simple controller test
class ConsultationControllerTest {

  @Autowired private MockMvc mockMvc;

  @Autowired private ObjectMapper objectMapper;

  @SuppressWarnings("removal")
  @MockBean
  private ConsultationService consultationService;

  @SuppressWarnings("removal")
  @MockBean
  private LlmToolService llmToolService;

  @Test
  @DisplayName("GET /api/v1/consultation/sessions/{id}/messages - 메시지 조회 성공")
  void should_메시지목록반환_when_정상조회() throws Exception {
    // given
    ChatMessageResponse msg =
        new ChatMessageResponse(1L, 1, "CUSTOMER", "TEXT", "Hello", OffsetDateTime.now());

    given(consultationService.getMessages(1L)).willReturn(List.of(msg));

    // when & then
    mockMvc
        .perform(get("/api/v1/consultation/sessions/1/messages"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].content").value("Hello"));
  }

  @Test
  @DisplayName("POST /api/v1/consultation/sessions/{id}/messages - 메시지 전송 성공")
  void should_메시지반환_when_정상전송() throws Exception {
    // given
    SendMessageRequest request = new SendMessageRequest();
    request.setContent("Reply");
    request.setNote(false);

    ChatMessageResponse response =
        new ChatMessageResponse(10L, 1, "AGENT", "TEXT", "Hello Operator", OffsetDateTime.now());

    given(consultationService.sendMessage(eq(1L), any(SendMessageRequest.class)))
        .willReturn(response);

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
  void should_세션응답반환_when_정상상태변경() throws Exception {
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

  @Test
  @DisplayName("POST /api/v1/consultation/sessions/{id}/messages - content 빈 문자열 → 400 Bad Request")
  void should_400반환_when_contentBlank() throws Exception {
    // given
    SendMessageRequest request = new SendMessageRequest();
    request.setContent(""); // @NotBlank 위반

    // when & then
    mockMvc
        .perform(
            post("/api/v1/consultation/sessions/1/messages")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
        .andExpect(jsonPath("$.errors").isArray())
        .andExpect(jsonPath("$.errors").isNotEmpty());
  }

  @Test
  @DisplayName("GET /api/v1/consultation/sessions/{id}/messages - 세션 없음 → 404 Not Found")
  void should_404반환_when_세션없음() throws Exception {
    // given
    given(consultationService.getMessages(999L))
        .willThrow(new NotFoundException("SESSION_NOT_FOUND", "Session not found: 999"));

    // when & then
    mockMvc
        .perform(get("/api/v1/consultation/sessions/999/messages"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("SESSION_NOT_FOUND"));
  }

  @Test
  @DisplayName("GET /api/v1/consultation/sessions/{id}/matched-workflow - 매칭 워크플로우 정보 반환")
  void should_매칭워크플로우반환_when_정상조회() throws Exception {
    // given
    LlmToolWorkflowResponse response =
        new LlmToolWorkflowResponse(
            1L,
            10L,
            42L,
            101L,
            50L,
            "RUNNING",
            "collect_slots",
            77L,
            "refund_v1",
            "환불 처리 워크플로우",
            "환불 요청 처리",
            objectMapper.readTree("{\"nodes\":[]}"),
            "collect_slots",
            objectMapper.readTree("[\"refund_granted\"]"));

    given(llmToolService.getCurrentWorkflow(new GetCurrentWorkflowCommand(1L))).willReturn(response);

    // when & then
    mockMvc
        .perform(get("/api/v1/consultation/sessions/1/matched-workflow"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sessionId").value(1))
        .andExpect(jsonPath("$.domainPackId").value(42))
        .andExpect(jsonPath("$.executionId").value(50))
        .andExpect(jsonPath("$.workflowCode").value("refund_v1"))
        .andExpect(jsonPath("$.currentState").value("collect_slots"))
        .andExpect(jsonPath("$.graphJson.nodes").isArray());
  }

  @Test
  @DisplayName(
      "GET /api/v1/consultation/sessions/{id}/matched-workflow - execution 없으면 200 + null 필드")
  void should_매칭워크플로우_null응답_when_execution없음() throws Exception {
    // given
    given(llmToolService.getCurrentWorkflow(new GetCurrentWorkflowCommand(1L)))
        .willReturn(
            new LlmToolWorkflowResponse(
                1L, 10L, 42L, 101L, null, null, null, null, null, null, null, null, null, null));

    // when & then
    mockMvc
        .perform(get("/api/v1/consultation/sessions/1/matched-workflow"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sessionId").value(1))
        .andExpect(jsonPath("$.domainPackId").value(42))
        .andExpect(jsonPath("$.executionId").doesNotExist())
        .andExpect(jsonPath("$.workflowCode").doesNotExist());
  }

  @Test
  @DisplayName("GET /api/v1/consultation/sessions/{id}/matched-workflow - 세션 없음 → 404")
  void should_404반환_when_매칭워크플로우_세션없음() throws Exception {
    // given
    given(llmToolService.getCurrentWorkflow(new GetCurrentWorkflowCommand(999L)))
        .willThrow(new NotFoundException("SESSION_NOT_FOUND", "Session not found: 999"));

    // when & then
    mockMvc
        .perform(get("/api/v1/consultation/sessions/999/matched-workflow"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("SESSION_NOT_FOUND"));
  }

  @Test
  @DisplayName("PATCH /api/v1/consultation/sessions/{id}/status - 유효하지 않은 상태값 → 400 Bad Request")
  void should_400반환_when_유효하지않은상태값() throws Exception {
    // given
    UpdateStatusRequest request = new UpdateStatusRequest();
    request.setStatus("INVALID_STATUS");

    willThrow(new BadRequestException("UNSUPPORTED_STATUS", "Unsupported status: INVALID_STATUS"))
        .given(consultationService)
        .updateSessionStatus(eq(1L), eq("INVALID_STATUS"));

    // when & then
    mockMvc
        .perform(
            patch("/api/v1/consultation/sessions/1/status")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("UNSUPPORTED_STATUS"));
  }
}
