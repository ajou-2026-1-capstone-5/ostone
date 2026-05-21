package com.init.workflowruntime.application;

import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.event.ChatMessageReceivedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class LlmResponseHandler {

  private static final Logger log = LoggerFactory.getLogger(LlmResponseHandler.class);

  private final LlmAssistantService llmAssistantService;
  private final ChatMessageRepository chatMessageRepository;
  private final SimpMessagingTemplate messagingTemplate;

  public LlmResponseHandler(
      LlmAssistantService llmAssistantService,
      ChatMessageRepository chatMessageRepository,
      SimpMessagingTemplate messagingTemplate) {
    this.llmAssistantService = llmAssistantService;
    this.chatMessageRepository = chatMessageRepository;
    this.messagingTemplate = messagingTemplate;
  }

  @Async
  @EventListener
  @Transactional
  public void handleChatMessageReceived(ChatMessageReceivedEvent event) {
    try {
      String llmResponse = llmAssistantService.generateResponse("", event.content());

      Integer nextSeqNo =
          chatMessageRepository
              .findTopByChatSessionIdOrderBySeqNoDesc(event.sessionId())
              .map(msg -> msg.getSeqNo() + 1)
              .orElse(1);

      ChatMessage savedMessage =
          chatMessageRepository.save(
              ChatMessage.create(
                  event.sessionId(), nextSeqNo, "ASSISTANT", "TEXT", llmResponse));

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
}
