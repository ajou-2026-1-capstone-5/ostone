package com.init.workflowruntime.presentation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.ChatWebSocketService;
import com.init.workflowruntime.application.dto.ChatMessageRequest;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.application.dto.SendChatMessageCommand;
import java.security.Principal;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;

@ExtendWith(MockitoExtension.class)
@DisplayName("ChatWebSocketController")
class ChatWebSocketControllerTest {

  @Mock private ChatWebSocketService chatWebSocketService;

  private ChatWebSocketController controller;

  @BeforeEach
  void setUp() {
    controller = new ChatWebSocketController(chatWebSocketService);
  }

  @Test
  @DisplayName("sendMessage: 정상 요청 → 서비스 호출 및 응답 반환")
  void should_returnResponse_when_validRequest() {
    ChatMessageRequest request = new ChatMessageRequest();
    request.setSessionId(1L);
    request.setContent("Hello");

    Principal principal = () -> "42";

    ChatMessageResponse expected =
        new ChatMessageResponse(10L, 1, "USER", "TEXT", "Hello", OffsetDateTime.now());

    given(chatWebSocketService.saveAndBroadcast(any(SendChatMessageCommand.class)))
        .willReturn(expected);

    ChatMessageResponse result = controller.sendMessage(request, "simp-123", principal);

    assertThat(result).isEqualTo(expected);
    assertThat(result.content()).isEqualTo("Hello");
  }

  @Test
  @DisplayName("sendMessage: 세션 없음 → NotFoundException 전파")
  void should_propagateNotFoundException_when_sessionNotFound() {
    ChatMessageRequest request = new ChatMessageRequest();
    request.setSessionId(999L);
    request.setContent("Hello");

    Principal principal = () -> "42";

    given(chatWebSocketService.saveAndBroadcast(any(SendChatMessageCommand.class)))
        .willThrow(new NotFoundException("SESSION_NOT_FOUND", "Session not found: 999"));

    assertThatThrownBy(() -> controller.sendMessage(request, "simp-999", principal))
        .isInstanceOf(NotFoundException.class)
        .satisfies(
            e -> assertThat(((NotFoundException) e).getCode()).isEqualTo("SESSION_NOT_FOUND"));
  }

  @Test
  @DisplayName("handleException: BusinessException → code + message 반환")
  void should_returnErrorMessage_when_businessException() {
    SimpMessageHeaderAccessor headerAccessor = SimpMessageHeaderAccessor.create();
    Exception ex = new NotFoundException("SESSION_NOT_FOUND", "Session not found: 999");

    ChatMessageResponse result = controller.handleException(ex, headerAccessor);

    assertThat(result.content()).contains("[SESSION_NOT_FOUND] Session not found: 999");
  }

  @Test
  @DisplayName("handleException: 일반 Exception → INTERNAL_ERROR 반환")
  void should_returnInternalError_when_genericException() {
    SimpMessageHeaderAccessor headerAccessor = SimpMessageHeaderAccessor.create();
    Exception ex = new RuntimeException("Unexpected error");

    ChatMessageResponse result = controller.handleException(ex, headerAccessor);

    assertThat(result.content()).contains("INTERNAL_ERROR");
    assertThat(result.content()).contains("서버 오류가 발생했습니다.");
  }
}
