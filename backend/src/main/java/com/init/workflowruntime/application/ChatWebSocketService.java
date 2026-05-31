package com.init.workflowruntime.application;

import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.application.dto.SendChatMessageCommand;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.domain.event.ConsultationQueueChangedEvent;
import com.init.workflowruntime.domain.event.ConsultationQueueEventType;
import com.init.workflowruntime.event.ChatMessageReceivedEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
@Transactional(readOnly = true)
public class ChatWebSocketService {

  private final ChatSessionRepository chatSessionRepository;
  private final ChatMessageRepository chatMessageRepository;
  private final SimpMessagingTemplate messagingTemplate;
  private final ApplicationEventPublisher eventPublisher;
  private final ChatSessionMetadataService chatSessionMetadataService;

  public ChatWebSocketService(
      ChatSessionRepository chatSessionRepository,
      ChatMessageRepository chatMessageRepository,
      SimpMessagingTemplate messagingTemplate,
      ApplicationEventPublisher eventPublisher,
      ChatSessionMetadataService chatSessionMetadataService) {
    this.chatSessionRepository = chatSessionRepository;
    this.chatMessageRepository = chatMessageRepository;
    this.messagingTemplate = messagingTemplate;
    this.eventPublisher = eventPublisher;
    this.chatSessionMetadataService = chatSessionMetadataService;
  }

  @Transactional
  public ChatMessageResponse saveAndBroadcast(SendChatMessageCommand command) {
    ChatSession session =
        chatSessionRepository
            .findByIdForUpdate(command.sessionId())
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "SESSION_NOT_FOUND", "Session not found: " + command.sessionId()));

    if ("USER".equals(command.senderRole()) && !command.userId().equals(session.getStartedBy())) {
      throw new BadRequestException(
          "SESSION_ACCESS_DENIED",
          "User " + command.userId() + " does not own session " + command.sessionId());
    }

    ChatSessionStatus status = session.getStatus();
    if (status != ChatSessionStatus.OPEN && status != ChatSessionStatus.ACTIVE) {
      throw new BadRequestException(
          "SESSION_NOT_OPEN_OR_ACTIVE",
          "Session " + command.sessionId() + " is not open or active; current status: " + status);
    }

    Integer nextSeqNo =
        chatMessageRepository
            .findTopByChatSessionIdOrderBySeqNoDesc(command.sessionId())
            .map(msg -> msg.getSeqNo() + 1)
            .orElse(1);

    ChatMessage message =
        ChatMessage.create(
            command.sessionId(), nextSeqNo, command.senderRole(), "TEXT", command.content());
    ChatMessage savedMessage = chatMessageRepository.save(message);
    chatSessionMetadataService.updateAfterMessage(session, savedMessage);
    if (isCustomerRole(command.senderRole())) {
      eventPublisher.publishEvent(
          new ConsultationQueueChangedEvent(
              session.getWorkspaceId(),
              command.sessionId(),
              ConsultationQueueEventType.SESSION_UPSERTED));
    }

    ChatMessageResponse response = ChatMessageResponse.from(savedMessage);
    String destination = "/topic/chat." + command.sessionId();

    TransactionSynchronizationManager.registerSynchronization(
        new TransactionSynchronization() {
          @Override
          public void afterCommit() {
            try {
              messagingTemplate.convertAndSend(destination, response);
            } finally {
              eventPublisher.publishEvent(
                  new ChatMessageReceivedEvent(command.sessionId(), command.content(), null));
            }
          }
        });

    return response;
  }

  private static boolean isCustomerRole(String senderRole) {
    return "USER".equals(senderRole) || "CUSTOMER".equals(senderRole);
  }
}
