package com.init.workflowruntime.application;

import com.init.workflowruntime.application.dto.ChatSessionResponse;
import com.init.workflowruntime.application.dto.ConsultationQueueEventResponse;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.event.ConsultationQueueChangedEvent;
import java.time.OffsetDateTime;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class ConsultationQueueEventListener {

  private static final Logger log = LoggerFactory.getLogger(ConsultationQueueEventListener.class);

  private final ChatSessionRepository chatSessionRepository;
  private final SimpMessagingTemplate messagingTemplate;

  public ConsultationQueueEventListener(
      ChatSessionRepository chatSessionRepository, SimpMessagingTemplate messagingTemplate) {
    this.chatSessionRepository = chatSessionRepository;
    this.messagingTemplate = messagingTemplate;
  }

  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
  public void handleQueueChanged(ConsultationQueueChangedEvent event) {
    ChatSession session = chatSessionRepository.findById(event.sessionId()).orElse(null);
    if (session == null) {
      log.warn(
          "ConsultationQueueChangedEvent: session {} not found, skipping notification",
          event.sessionId());
      return;
    }

    ConsultationQueueEventResponse response =
        new ConsultationQueueEventResponse(
            event.type(), ChatSessionResponse.from(session), OffsetDateTime.now());
    messagingTemplate.convertAndSend(
        "/topic/workspaces." + event.workspaceId() + ".consultation.queue", response);
  }
}
