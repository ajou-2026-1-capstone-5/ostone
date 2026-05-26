package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

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
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@ExtendWith(MockitoExtension.class)
@DisplayName("ChatWebSocketService")
class ChatWebSocketServiceTest {

  @Mock private ChatSessionRepository chatSessionRepository;
  @Mock private ChatMessageRepository chatMessageRepository;
  @Mock private SimpMessagingTemplate messagingTemplate;
  @Mock private ApplicationEventPublisher eventPublisher;

  private ChatWebSocketService service;

  @BeforeEach
  void setUp() {
    service =
        new ChatWebSocketService(
            chatSessionRepository, chatMessageRepository, messagingTemplate, eventPublisher);
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
  @DisplayName("saveAndBroadcast: 세션 상태가 ACTIVE → 정상 저장 및 afterCommit broadcast")
  void should_saveAndBroadcast_when_sessionActive() {
    ChatSession session = createSession(1L, ChatSessionStatus.ACTIVE);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));

    given(chatMessageRepository.findTopByChatSessionIdOrderBySeqNoDesc(1L))
        .willReturn(Optional.empty());

    ChatMessage savedMsg = createMessage(1L, 1, "USER", "Hello");
    given(chatMessageRepository.save(any())).willReturn(savedMsg);

    TransactionSynchronizationManager.initSynchronization();
    try {
      ChatMessageResponse result =
          service.saveAndBroadcast(new SendChatMessageCommand(1L, "Hello", 1L, "USER"));

      assertThat(result).isNotNull();
      assertThat(result.content()).isEqualTo("Hello");
      assertThat(result.senderRole()).isEqualTo("USER");
      verify(chatMessageRepository).save(any());

      // 즉시 전송되지 않음
      verify(messagingTemplate, never()).convertAndSend(anyString(), any(Object.class));

      // afterCommit 수동 트리거
      TransactionSynchronizationManager.getSynchronizations().forEach(s -> s.afterCommit());

      // 커밋 후 전송 확인
      verify(messagingTemplate).convertAndSend("/topic/chat.1", result);
    } finally {
      TransactionSynchronizationManager.clearSynchronization();
    }
  }

  @Test
  @DisplayName("saveAndBroadcast: 세션 소유자가 다른 사용자 → SESSION_ACCESS_DENIED")
  void should_throwBadRequest_when_userDoesNotOwnSession() {
    ChatSession session = createSession(1L, ChatSessionStatus.OPEN);
    ReflectionTestUtils.setField(session, "startedBy", 99L);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));

    assertThatThrownBy(
            () -> service.saveAndBroadcast(new SendChatMessageCommand(1L, "Hello", 1L, "USER")))
        .isInstanceOf(com.init.shared.application.exception.BadRequestException.class)
        .hasMessageContaining("does not own session");
  }

  @Test
  @DisplayName("saveAndBroadcast: 세션 상태가 COMPLETED → SESSION_NOT_OPEN_OR_ACTIVE")
  void should_throwBadRequest_when_sessionCompleted() {
    ChatSession session = createSession(1L, ChatSessionStatus.COMPLETED);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));

    assertThatThrownBy(
            () -> service.saveAndBroadcast(new SendChatMessageCommand(1L, "Hello", 1L, "USER")))
        .isInstanceOf(com.init.shared.application.exception.BadRequestException.class)
        .hasMessageContaining("is not open or active");
  }

  @Test
  @DisplayName("saveAndBroadcast: 세션 상태가 OPEN → 정상 저장 및 afterCommit broadcast")
  void should_saveAndBroadcast_when_sessionOpen() {
    ChatSession session = createSession(1L, ChatSessionStatus.OPEN);
    given(chatSessionRepository.findByIdForUpdate(1L)).willReturn(Optional.of(session));

    given(chatMessageRepository.findTopByChatSessionIdOrderBySeqNoDesc(1L))
        .willReturn(Optional.empty());

    ChatMessage savedMsg = createMessage(1L, 1, "USER", "Hello");
    given(chatMessageRepository.save(any())).willReturn(savedMsg);

    TransactionSynchronizationManager.initSynchronization();
    try {
      ChatMessageResponse result =
          service.saveAndBroadcast(new SendChatMessageCommand(1L, "Hello", 1L, "USER"));

      assertThat(result).isNotNull();
      assertThat(result.content()).isEqualTo("Hello");
      verify(chatMessageRepository).save(any());

      verify(messagingTemplate, never()).convertAndSend(anyString(), any(Object.class));

      TransactionSynchronizationManager.getSynchronizations().forEach(s -> s.afterCommit());

      verify(messagingTemplate).convertAndSend("/topic/chat.1", result);
    } finally {
      TransactionSynchronizationManager.clearSynchronization();
    }
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
