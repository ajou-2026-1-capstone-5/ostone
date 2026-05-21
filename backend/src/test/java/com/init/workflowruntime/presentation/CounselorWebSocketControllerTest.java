package com.init.workflowruntime.presentation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.CounselorService;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.application.dto.CounselorMessageRequest;
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
@DisplayName("CounselorWebSocketController")
class CounselorWebSocketControllerTest {

  @Mock private CounselorService counselorService;

  private CounselorWebSocketController controller;

  @BeforeEach
  void setUp() {
    controller = new CounselorWebSocketController(counselorService);
  }

  @Test
  @DisplayName("sendCounselorMessage: 정상 요청 → 서비스 호출 및 응답 반환")
  void should_returnResponse_when_validRequest() {
    CounselorMessageRequest request = new CounselorMessageRequest();
    request.setSessionId(1L);
    request.setContent("Counselor message");

    Principal principal = () -> "42";

    ChatMessageResponse expected =
        new ChatMessageResponse(10L, 1, "COUNSELOR", "TEXT", "Counselor message", OffsetDateTime.now());

    given(counselorService.sendCounselorMessage(1L, "Counselor message", 42L))
        .willReturn(expected);

    ChatMessageResponse result = controller.sendCounselorMessage(request, principal);

    assertThat(result).isEqualTo(expected);
    assertThat(result.senderRole()).isEqualTo("COUNSELOR");
  }

  @Test
  @DisplayName("sendCounselorMessage: 배정되지 않은 세션 → NotFoundException 전파")
  void should_propagateNotFoundException_when_sessionNotFound() {
    CounselorMessageRequest request = new CounselorMessageRequest();
    request.setSessionId(999L);
    request.setContent("Hello");

    Principal principal = () -> "42";

    given(counselorService.sendCounselorMessage(999L, "Hello", 42L))
        .willThrow(new NotFoundException("SESSION_NOT_FOUND", "Session not found: 999"));

    assertThatThrownBy(() -> controller.sendCounselorMessage(request, principal))
        .isInstanceOf(NotFoundException.class)
        .satisfies(e -> assertThat(((NotFoundException) e).getCode()).isEqualTo("SESSION_NOT_FOUND"));
  }

  @Test
  @DisplayName("sendCounselorMessage: 권한 없는 상담사 → BadRequestException 전파")
  void should_propagateBadRequestException_when_notAssigned() {
    CounselorMessageRequest request = new CounselorMessageRequest();
    request.setSessionId(1L);
    request.setContent("Hello");

    Principal principal = () -> "99";

    given(counselorService.sendCounselorMessage(1L, "Hello", 99L))
        .willThrow(new BadRequestException("SESSION_NOT_ASSIGNED",
            "Session 1 is not assigned to counselor: 99"));

    assertThatThrownBy(() -> controller.sendCounselorMessage(request, principal))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("not assigned to counselor");
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
