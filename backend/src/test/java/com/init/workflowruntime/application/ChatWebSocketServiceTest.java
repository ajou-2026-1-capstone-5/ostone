package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.application.dto.SendChatMessageCommand;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("ChatWebSocketService")
class ChatWebSocketServiceTest {

  @Mock private ChatSessionRepository chatSessionRepository;
  @Mock private ChatMessageRepository chatMessageRepository;
  @Mock private SimpMessagingTemplate messagingTemplate;

  private ChatWebSocketService service;

  @BeforeEach
  void setUp() {
    service =
        new ChatWebSocketService(chatSessionRepository, chatMessageRepository, messagingTemplate);
  }

  @Test
  @DisplayName("saveAndBroadcast: 세션 없음 → NotFoundException")
  void should_throwNotFoundException_when_sessionNotFound() {
    given(chatSessionRepository.findByIdForUpdate(999L)).willReturn(Optional.empty());

    assertThatThrownBy(
            () -> service.saveAndBroadcast(new SendChatMessageCommand(999L, "Hello", 1L, "USER")))
        .isInstanceOf(NotFoundException.class)
        .hasMessageContaining("Session not found: 999");
  }

  @Test
  @DisplayName("saveAndBroadcast: 세션 상태가 ACTIVE → 정상 저장 및 broadcast")
  void should_saveAndBroadcast_when_sessionActive() {
    ChatSession session = createSession(1L, ChatSessionStatus.ACTIVE);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));

    given(chatMessageRepository.findTopByChatSessionIdOrderBySeqNoDesc(1L))
        .willReturn(Optional.empty());

    ChatMessage savedMsg = createMessage(1L, 1, "USER", "Hello");
    given(chatMessageRepository.save(any())).willReturn(savedMsg);

    ChatMessageResponse result =
        service.saveAndBroadcast(new SendChatMessageCommand(1L, "Hello", 1L, "USER"));

    assertThat(result).isNotNull();
    assertThat(result.content()).isEqualTo("Hello");
    assertThat(result.senderRole()).isEqualTo("USER");
    verify(chatMessageRepository).save(any());
    verify(messagingTemplate).convertAndSend("/topic/chat.1", result);
  }

  @Test
  @DisplayName("saveAndBroadcast: 세션 상태가 OPEN → 정상 저장 및 broadcast")
  void should_saveAndBroadcast_when_sessionOpen() {
    ChatSession session = createSession(1L, ChatSessionStatus.OPEN);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));

    given(chatMessageRepository.findTopByChatSessionIdOrderBySeqNoDesc(1L))
        .willReturn(Optional.empty());

    ChatMessage savedMsg = createMessage(1L, 1, "USER", "Hello");
    given(chatMessageRepository.save(any())).willReturn(savedMsg);

    ChatMessageResponse result =
        service.saveAndBroadcast(new SendChatMessageCommand(1L, "Hello", 1L, "USER"));

    assertThat(result).isNotNull();
    assertThat(result.content()).isEqualTo("Hello");
    verify(chatMessageRepository).save(any());
    verify(messagingTemplate).convertAndSend("/topic/chat.1", result);
  }

  @Test
  @DisplayName("saveAndBroadcast: 세션 상태가 COMPLETED → BadRequestException")
  void should_throwBadRequestException_when_sessionCompleted() {
    ChatSession session = createSession(1L, ChatSessionStatus.COMPLETED);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));

    assertThatThrownBy(
            () -> service.saveAndBroadcast(new SendChatMessageCommand(1L, "Hello", 1L, "USER")))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("is not open or active");
  }

  @Test
  @DisplayName("saveAndBroadcast: 기존 메시지 있음 → seqNo 증가 확인")
  void should_incrementSeqNo_when_existingMessages() {
    ChatSession session = createSession(1L, ChatSessionStatus.ACTIVE);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));

    ChatMessage lastMsg = createMessage(1L, 3, "USER", "Previous");
    given(chatMessageRepository.findTopByChatSessionIdOrderBySeqNoDesc(1L))
        .willReturn(Optional.of(lastMsg));

    ChatMessage savedMsg = createMessage(1L, 4, "USER", "New message");
    given(chatMessageRepository.save(any())).willReturn(savedMsg);

    ChatMessageResponse result =
        service.saveAndBroadcast(new SendChatMessageCommand(1L, "New message", 1L, "USER"));

    assertThat(result.seqNo()).isEqualTo(4);
  }

  @Test
  @DisplayName("saveAndBroadcast: messagingTemplate.convertAndSend 호출 확인")
  void should_callConvertAndSend_when_saved() {
    ChatSession session = createSession(1L, ChatSessionStatus.ACTIVE);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));

    given(chatMessageRepository.findTopByChatSessionIdOrderBySeqNoDesc(1L))
        .willReturn(Optional.empty());

    ChatMessage savedMsg = createMessage(1L, 1, "USER", "Hello");
    given(chatMessageRepository.save(any())).willReturn(savedMsg);

    ChatMessageResponse result =
        service.saveAndBroadcast(new SendChatMessageCommand(1L, "Hello", 1L, "USER"));

    verify(messagingTemplate).convertAndSend(eq("/topic/chat.1"), eq(result));
  }

  private ChatSession createSession(Long id, ChatSessionStatus status) {
    ChatSession session = ChatSession.create(1L, 1L, status, "WEB", "{}");
    ReflectionTestUtils.setField(session, "id", id);
    return session;
  }

  private ChatMessage createMessage(Long sessionId, int seqNo, String role, String content) {
    ChatMessage msg = ChatMessage.create(sessionId, seqNo, role, "TEXT", content);
    ReflectionTestUtils.setField(msg, "id", 1L);
    return msg;
  }
}
