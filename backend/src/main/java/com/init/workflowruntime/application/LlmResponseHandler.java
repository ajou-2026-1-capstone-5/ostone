package com.init.workflowruntime.application;

import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.command.GenerateWorkflowAwareResponseCommand;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.event.ChatMessageReceivedEvent;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Component
public class LlmResponseHandler {

  private static final Logger log = LoggerFactory.getLogger(LlmResponseHandler.class);

  private final LlmAssistantService llmAssistantService;
  private final ChatMessageRepository chatMessageRepository;
  private final ChatSessionRepository chatSessionRepository;
  private final SimpMessagingTemplate messagingTemplate;
  private final ChatSessionMetadataService chatSessionMetadataService;
  private final TransactionTemplate transactionTemplate;

  public LlmResponseHandler(
      LlmAssistantService llmAssistantService,
      ChatMessageRepository chatMessageRepository,
      ChatSessionRepository chatSessionRepository,
      SimpMessagingTemplate messagingTemplate,
      ChatSessionMetadataService chatSessionMetadataService,
      PlatformTransactionManager transactionManager) {
    this.llmAssistantService = llmAssistantService;
    this.chatMessageRepository = chatMessageRepository;
    this.chatSessionRepository = chatSessionRepository;
    this.messagingTemplate = messagingTemplate;
    this.chatSessionMetadataService = chatSessionMetadataService;
    this.transactionTemplate = new TransactionTemplate(transactionManager);
  }

  @Async
  @EventListener
  public void handleChatMessageReceived(ChatMessageReceivedEvent event) {
    try {
      String conversationContext = loadConversationContext(event.sessionId());

      String llmResponse =
          llmAssistantService
              .generateWorkflowAwareResponse(
                  new GenerateWorkflowAwareResponseCommand(
                      event.sessionId(), conversationContext, event.content()))
              .content();

      ChatMessage savedMessage = saveAssistantMessage(event.sessionId(), llmResponse);

      ChatMessageResponse response = ChatMessageResponse.from(savedMessage);
      String destination = "/topic/chat." + event.sessionId();
      messagingTemplate.convertAndSend(destination, response);

    } catch (Exception e) {
      log.error(
          "LLM response generation failed for session {}: {}",
          event.sessionId(),
          e.getMessage(),
          e);

      ChatMessageResponse errorResponse =
          ChatMessageResponse.error("LLM_ERROR", "죄송합니다. 일시적인 오류가 발생했습니다.");
      messagingTemplate.convertAndSend("/topic/chat." + event.sessionId(), errorResponse);
    }
  }

  private String loadConversationContext(Long sessionId) {
    chatSessionRepository
        .findById(sessionId)
        .orElseThrow(
            () -> new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + sessionId));

    List<ChatMessage> recentDesc =
        chatMessageRepository.findTop5ByChatSessionIdOrderBySeqNoDesc(sessionId);
    Collections.reverse(recentDesc);
    return recentDesc.stream()
        .map(m -> m.getSenderRole() + ": " + m.getContent())
        .collect(Collectors.joining("\n"));
  }

  private ChatMessage saveAssistantMessage(Long sessionId, String llmResponse) {
    return transactionTemplate.execute(
        status -> {
          ChatSession session =
              chatSessionRepository
              .findByIdForUpdate(sessionId)
              .orElseThrow(
                  () ->
                      new NotFoundException(
                          "SESSION_NOT_FOUND", "Session not found: " + sessionId));

          Integer nextSeqNo =
              chatMessageRepository
                  .findTopByChatSessionIdOrderBySeqNoDesc(sessionId)
                  .map(msg -> msg.getSeqNo() + 1)
                  .orElse(1);

          ChatMessage savedMessage =
              chatMessageRepository.save(
              ChatMessage.create(sessionId, nextSeqNo, "ASSISTANT", "TEXT", llmResponse));
          chatSessionMetadataService.updateAfterMessage(session, savedMessage);
          return savedMessage;
        });
  }
}
