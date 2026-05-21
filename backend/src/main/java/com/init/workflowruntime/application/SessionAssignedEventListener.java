package com.init.workflowruntime.application;

import com.init.workflowruntime.application.dto.ChatSessionResponse;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.event.SessionAssignedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Component
@Transactional(readOnly = true)
public class SessionAssignedEventListener {

  private final ChatSessionRepository chatSessionRepository;
  private final SimpMessagingTemplate messagingTemplate;

  public SessionAssignedEventListener(
      ChatSessionRepository chatSessionRepository,
      SimpMessagingTemplate messagingTemplate) {
    this.chatSessionRepository = chatSessionRepository;
    this.messagingTemplate = messagingTemplate;
  }

  @EventListener
  @Transactional
  public void handleSessionAssigned(SessionAssignedEvent event) {
    ChatSession session = chatSessionRepository
        .findById(event.sessionId())
        .orElse(null);
    if (session == null) return;

    ChatSessionResponse response = ChatSessionResponse.from(session);
    String counselorQueue = "/queue/counselor.notifications";
    TransactionSynchronizationManager.registerSynchronization(
        new TransactionSynchronization() {
          @Override
          public void afterCommit() {
            messagingTemplate.convertAndSendToUser(
                String.valueOf(event.counselorId()), counselorQueue, response);
          }
        });
  }
}
