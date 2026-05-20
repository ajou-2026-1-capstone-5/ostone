package com.init.workflowruntime.application;

import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ChatWebSocketService {

  private final ChatSessionRepository chatSessionRepository;
  private final ChatMessageRepository chatMessageRepository;
  private final SimpMessagingTemplate messagingTemplate;

  public ChatWebSocketService(
      ChatSessionRepository chatSessionRepository,
      ChatMessageRepository chatMessageRepository,
      SimpMessagingTemplate messagingTemplate) {
    this.chatSessionRepository = chatSessionRepository;
    this.chatMessageRepository = chatMessageRepository;
    this.messagingTemplate = messagingTemplate;
  }

  @Transactional
  public ChatMessageResponse saveAndBroadcast(
      Long sessionId, String content, Long userId, String senderRole) {
    ChatSession session =
        chatSessionRepository
            .findById(sessionId)
            .orElseThrow(
                () ->
                    new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + sessionId));

    ChatSessionStatus status = session.getStatus();
    if (status != ChatSessionStatus.OPEN && status != ChatSessionStatus.ACTIVE) {
      throw new BadRequestException(
          "SESSION_NOT_OPEN_OR_ACTIVE",
          "Session " + sessionId + " is not open or active; current status: " + status);
    }

    Integer nextSeqNo =
        chatMessageRepository
            .findTopByChatSessionIdOrderBySeqNoDesc(sessionId)
            .map(msg -> msg.getSeqNo() + 1)
            .orElse(1);

    ChatMessage message = ChatMessage.create(sessionId, nextSeqNo, senderRole, "TEXT", content);
    chatMessageRepository.save(message);

    ChatMessageResponse response = ChatMessageResponse.from(message);
    messagingTemplate.convertAndSend("/topic/chat." + sessionId, response);

    return response;
  }
}
