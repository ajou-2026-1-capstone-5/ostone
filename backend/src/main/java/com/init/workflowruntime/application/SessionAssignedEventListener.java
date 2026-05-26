package com.init.workflowruntime.application;

import com.init.workflowruntime.application.dto.ChatSessionResponse;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.event.SessionAssignedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class SessionAssignedEventListener {

  private static final Logger log = LoggerFactory.getLogger(SessionAssignedEventListener.class);

  private final ChatSessionRepository chatSessionRepository;
  private final SimpMessagingTemplate messagingTemplate;

  public SessionAssignedEventListener(
      ChatSessionRepository chatSessionRepository, SimpMessagingTemplate messagingTemplate) {
    this.chatSessionRepository = chatSessionRepository;
    this.messagingTemplate = messagingTemplate;
  }

  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
  public void handleSessionAssigned(SessionAssignedEvent event) {
    ChatSession session = chatSessionRepository.findById(event.sessionId()).orElse(null);
    if (session == null) {
      log.warn(
          "SessionAssignedEvent: session {} not found, skipping notification", event.sessionId());
      return;
    }

    ChatSessionResponse response = ChatSessionResponse.from(session);
    String counselorQueue = "/queue/counselor.notifications";
    messagingTemplate.convertAndSendToUser(
        String.valueOf(event.counselorId()), counselorQueue, response);
  }
}
