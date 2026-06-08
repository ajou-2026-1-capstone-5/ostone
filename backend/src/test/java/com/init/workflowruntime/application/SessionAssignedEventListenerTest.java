package com.init.workflowruntime.application;

import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.chatSessionWithId;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.domain.event.SessionAssignedEvent;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

@ExtendWith(MockitoExtension.class)
@DisplayName("SessionAssignedEventListener")
class SessionAssignedEventListenerTest {

  @Mock private ChatSessionRepository chatSessionRepository;
  @Mock private SimpMessagingTemplate messagingTemplate;

  private SessionAssignedEventListener listener;

  @BeforeEach
  void setUp() {
    listener = new SessionAssignedEventListener(chatSessionRepository, messagingTemplate);
  }

  @Test
  @DisplayName("세션이 존재하면 상담사 큐에 STOMP 메시지를 전송한다")
  void should_sendNotification_when_sessionExists() {
    ChatSession session = ChatSession.create(1L, 1L, ChatSessionStatus.ACTIVE, "WEB", "{}");
    session = chatSessionWithId(session, 1L);
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));

    listener.handleSessionAssigned(new SessionAssignedEvent(1L, 42L));

    verify(messagingTemplate)
        .convertAndSendToUser(eq("42"), eq("/queue/counselor.notifications"), any());
  }

  @Test
  @DisplayName("세션이 없으면 STOMP 전송 없이 경고만 기록한다")
  void should_skipNotification_when_sessionNotFound() {
    given(chatSessionRepository.findById(99L)).willReturn(Optional.empty());

    listener.handleSessionAssigned(new SessionAssignedEvent(99L, 42L));

    verify(messagingTemplate, never()).convertAndSendToUser(any(), any(), any());
  }
}
