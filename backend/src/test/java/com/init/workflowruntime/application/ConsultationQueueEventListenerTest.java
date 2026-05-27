package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.workflowruntime.application.dto.ConsultationQueueEventResponse;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.domain.event.ConsultationQueueChangedEvent;
import com.init.workflowruntime.domain.event.ConsultationQueueEventType;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("ConsultationQueueEventListener")
class ConsultationQueueEventListenerTest {

  @Mock private ChatSessionRepository chatSessionRepository;
  @Mock private SimpMessagingTemplate messagingTemplate;

  @Test
  @DisplayName("handleQueueChanged: 세션을 재조회해 워크스페이스 큐 topic으로 브로드캐스트한다")
  void should_broadcastQueueEvent_when_sessionExists() {
    ConsultationQueueEventListener listener =
        new ConsultationQueueEventListener(chatSessionRepository, messagingTemplate);
    ChatSession session = ChatSession.create(2L, 10L, ChatSessionStatus.OPEN, "WEB", "{}");
    ReflectionTestUtils.setField(session, "id", 1L);
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));

    listener.handleQueueChanged(
        new ConsultationQueueChangedEvent(2L, 1L, ConsultationQueueEventType.SESSION_UPSERTED));

    ArgumentCaptor<ConsultationQueueEventResponse> responseCaptor =
        ArgumentCaptor.forClass(ConsultationQueueEventResponse.class);
    verify(messagingTemplate).convertAndSend(eq(eqTopic()), responseCaptor.capture());
    assertThat(responseCaptor.getValue().getType())
        .isEqualTo(ConsultationQueueEventType.SESSION_UPSERTED);
    assertThat(responseCaptor.getValue().getSession().getId()).isEqualTo(1L);
    assertThat(responseCaptor.getValue().getOccurredAt()).isNotNull();
  }

  @Test
  @DisplayName("handleQueueChanged: 세션이 없으면 브로드캐스트하지 않는다")
  void should_skipBroadcast_when_sessionMissing() {
    ConsultationQueueEventListener listener =
        new ConsultationQueueEventListener(chatSessionRepository, messagingTemplate);
    given(chatSessionRepository.findById(1L)).willReturn(Optional.empty());

    listener.handleQueueChanged(
        new ConsultationQueueChangedEvent(2L, 1L, ConsultationQueueEventType.SESSION_REMOVED));

    verify(messagingTemplate, never()).convertAndSend(anyString(), any(Object.class));
  }

  private String eqTopic() {
    return "/topic/workspaces.2.consultation.queue";
  }
}
