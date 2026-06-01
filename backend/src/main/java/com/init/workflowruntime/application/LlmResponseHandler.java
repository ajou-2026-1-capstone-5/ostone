package com.init.workflowruntime.application;

import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.command.GenerateWorkflowAwareResponseCommand;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.config.AiConfig;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.event.ChatMessageReceivedEvent;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
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
  private static final String CHAT_TOPIC_PREFIX = "/topic/chat.";

  private final LlmAssistantService llmAssistantService;
  private final ChatMessageRepository chatMessageRepository;
  private final ChatSessionRepository chatSessionRepository;
  private final SimpMessagingTemplate messagingTemplate;
  private final ChatSessionMetadataService chatSessionMetadataService;
  private final TransactionTemplate transactionTemplate;
  private final AiResponseGenerationGuard aiResponseGenerationGuard;

  public LlmResponseHandler(
      LlmAssistantService llmAssistantService,
      ChatMessageRepository chatMessageRepository,
      ChatSessionRepository chatSessionRepository,
      SimpMessagingTemplate messagingTemplate,
      ChatSessionMetadataService chatSessionMetadataService,
      PlatformTransactionManager transactionManager,
      AiResponseGenerationGuard aiResponseGenerationGuard) {
    this.llmAssistantService = llmAssistantService;
    this.chatMessageRepository = chatMessageRepository;
    this.chatSessionRepository = chatSessionRepository;
    this.messagingTemplate = messagingTemplate;
    this.chatSessionMetadataService = chatSessionMetadataService;
    this.transactionTemplate = new TransactionTemplate(transactionManager);
    this.aiResponseGenerationGuard = aiResponseGenerationGuard;
  }

  @Async(AiConfig.LLM_AUTO_RESPONSE_TASK_EXECUTOR)
  @EventListener
  public void handleChatMessageReceived(ChatMessageReceivedEvent event) {
    try {
      Optional<String> conversationContext = loadConversationContextIfAutoResponseEnabled(event);
      if (conversationContext.isEmpty()) {
        return;
      }

      Optional<AiResponseGenerationGuard.Lease> lease =
          aiResponseGenerationGuard.tryEnter(event.sessionId());
      if (lease.isEmpty()) {
        sendGenerationInProgressNotice(event.sessionId());
        return;
      }

      try (AiResponseGenerationGuard.Lease ignored = lease.get()) {
        generateAndSendResponse(event, conversationContext.get());
      }
    } catch (Exception e) {
      log.error(
          "LLM response generation failed for session {}: {}",
          event.sessionId(),
          e.getMessage(),
          e);

      ChatMessageResponse errorResponse =
          ChatMessageResponse.error("LLM_ERROR", "죄송합니다. 일시적인 오류가 발생했습니다.");
      if (allowsAiAutoResponse(event.sessionId())) {
        messagingTemplate.convertAndSend(CHAT_TOPIC_PREFIX + event.sessionId(), errorResponse);
      }
    }
  }

  private void generateAndSendResponse(ChatMessageReceivedEvent event, String conversationContext) {
    String llmResponse =
        llmAssistantService
            .generateWorkflowAwareResponse(
                new GenerateWorkflowAwareResponseCommand(
                    event.sessionId(), conversationContext, event.content()))
            .content();

    Optional<ChatMessage> savedMessage = saveAssistantMessage(event.sessionId(), llmResponse);
    if (savedMessage.isEmpty()) {
      return;
    }

    ChatMessageResponse response = ChatMessageResponse.from(savedMessage.get());
    String destination = CHAT_TOPIC_PREFIX + event.sessionId();
    messagingTemplate.convertAndSend(destination, response);
  }

  private void sendGenerationInProgressNotice(Long sessionId) {
    ChatMessageResponse response =
        ChatMessageResponse.error(
            AiResponseGenerationGuard.IN_PROGRESS_CODE,
            AiResponseGenerationGuard.IN_PROGRESS_MESSAGE);
    messagingTemplate.convertAndSend(CHAT_TOPIC_PREFIX + sessionId, response);
  }

  private Optional<String> loadConversationContextIfAutoResponseEnabled(
      ChatMessageReceivedEvent event) {
    ChatSession session =
        chatSessionRepository
            .findById(event.sessionId())
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "SESSION_NOT_FOUND", "Session not found: " + event.sessionId()));

    if (!session.allowsAiAutoResponse()) {
      log.info(
          "Skip LLM auto response for session {} because response mode is {}",
          event.sessionId(),
          session.getResponseMode());
      return Optional.empty();
    }

    List<ChatMessage> recentDesc =
        chatMessageRepository.findTop5ByChatSessionIdOrderBySeqNoDesc(event.sessionId());
    Collections.reverse(recentDesc);
    return Optional.of(
        recentDesc.stream()
            .map(m -> m.getSenderRole() + ": " + m.getContent())
            .collect(Collectors.joining("\n")));
  }

  private Optional<ChatMessage> saveAssistantMessage(Long sessionId, String llmResponse) {
    Optional<ChatMessage> savedMessage =
        transactionTemplate.execute(
            status -> {
              ChatSession session =
                  chatSessionRepository
                      .findByIdForUpdate(sessionId)
                      .orElseThrow(
                          () ->
                              new NotFoundException(
                                  "SESSION_NOT_FOUND", "Session not found: " + sessionId));

              if (!session.allowsAiAutoResponse()) {
                log.info(
                    "Skip saving LLM auto response for session {} because response mode changed to"
                        + " {}",
                    sessionId,
                    session.getResponseMode());
                return Optional.empty();
              }

              Integer nextSeqNo =
                  chatMessageRepository
                      .findTopByChatSessionIdOrderBySeqNoDesc(sessionId)
                      .map(msg -> msg.getSeqNo() + 1)
                      .orElse(1);

              ChatMessage saved =
                  chatMessageRepository.save(
                      ChatMessage.create(sessionId, nextSeqNo, "ASSISTANT", "TEXT", llmResponse));
              if (saved == null) {
                throw new IllegalStateException(
                    "Assistant message save returned null for session: " + sessionId);
              }
              chatSessionMetadataService.updateAfterMessage(session, saved);
              return Optional.of(saved);
            });
    return savedMessage;
  }

  private boolean allowsAiAutoResponse(Long sessionId) {
    return chatSessionRepository
        .findById(sessionId)
        .map(ChatSession::allowsAiAutoResponse)
        .orElse(false);
  }
}
