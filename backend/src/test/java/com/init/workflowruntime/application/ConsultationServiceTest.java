package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.application.dto.ChatSessionResponse;
import com.init.workflowruntime.application.dto.SendMessageRequest;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("ConsultationService")
class ConsultationServiceTest {

  @Mock private ChatSessionRepository chatSessionRepository;
  @Mock private ChatMessageRepository chatMessageRepository;

  private ConsultationService service;

  @BeforeEach
  void setUp() {
    service = new ConsultationService(chatSessionRepository, chatMessageRepository);
  }

  @Test
  @DisplayName("getMessages: 세션 없음 → NotFoundException 발생")
  void should_NotFoundException발생_when_세션없음() {
    // given
    given(chatSessionRepository.findById(999L)).willReturn(Optional.empty());

    // when & then
    assertThatThrownBy(() -> service.getMessages(999L))
        .isInstanceOf(NotFoundException.class)
        .hasMessageContaining("Session not found");
  }

  @Test
  @DisplayName("getMessages: 세션 존재 → 메시지 목록 반환")
  void should_메시지목록반환_when_세션존재() {
    // given
    ChatSession session = createSession(1L);
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(chatMessageRepository.findByChatSessionIdOrderBySeqNoAsc(1L)).willReturn(List.of());

    // when
    List<ChatMessageResponse> result = service.getMessages(1L);

    // then
    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName("sendMessage: 정상 전송 → 생성된 메시지 응답 반환")
  void should_생성된메시지반환_when_정상전송() {
    // given
    ChatSession session = createSession(1L);
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(chatMessageRepository.findTopByChatSessionIdOrderBySeqNoDesc(1L))
        .willReturn(Optional.empty());

    ChatMessage savedMsg = createMessage(1L, 1, "AGENT", "Hello");
    given(chatMessageRepository.save(any())).willReturn(savedMsg);

    SendMessageRequest request = new SendMessageRequest();
    request.setContent("Hello");
    request.setNote(false);

    // when
    ChatMessageResponse result = service.sendMessage(1L, request);

    // then
    assertThat(result.content()).isEqualTo("Hello");
    assertThat(result.senderRole()).isEqualTo("AGENT");
    verify(chatMessageRepository).save(any());
  }

  @Test
  @DisplayName("updateSessionStatus: COMPLETED → closeSession 호출 후 응답 반환")
  void should_세션응답반환_when_COMPLETED상태로변경() {
    // given
    ChatSession session = createSession(1L);
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));

    // when
    ChatSessionResponse result = service.updateSessionStatus(1L, "COMPLETED");

    // then
    assertThat(result).isNotNull();
    assertThat(result.getStatus()).isEqualTo("COMPLETED");
  }

  @Test
  @DisplayName("updateSessionStatus: 알 수 없는 상태 → BadRequestException 발생")
  void should_BadRequestException발생_when_알수없는상태() {
    // given
    ChatSession session = createSession(1L);
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));

    // when & then
    assertThatThrownBy(() -> service.updateSessionStatus(1L, "INVALID_STATUS"))
        .isInstanceOf(BadRequestException.class);
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private ChatSession createSession(Long id) {
    ChatSession session = ChatSession.create(1L, 1L, ChatSessionStatus.OPEN, "WEB", "{}");
    ReflectionTestUtils.setField(session, "id", id);
    return session;
  }

  private ChatMessage createMessage(Long sessionId, int seqNo, String role, String content) {
    ChatMessage msg = ChatMessage.create(sessionId, seqNo, role, "TEXT", content);
    ReflectionTestUtils.setField(msg, "id", 1L);
    return msg;
  }
}
