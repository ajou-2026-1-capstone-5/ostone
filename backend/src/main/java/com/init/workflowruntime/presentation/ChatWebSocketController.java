package com.init.workflowruntime.presentation;

import com.init.shared.application.exception.BusinessException;
import com.init.workflowruntime.application.ChatWebSocketService;
import com.init.workflowruntime.application.dto.ChatMessageRequest;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import jakarta.validation.Valid;
import java.security.Principal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;

@Controller
public class ChatWebSocketController {

  private static final Logger log = LoggerFactory.getLogger(ChatWebSocketController.class);

  private final ChatWebSocketService chatWebSocketService;

  public ChatWebSocketController(ChatWebSocketService chatWebSocketService) {
    this.chatWebSocketService = chatWebSocketService;
  }

  @MessageMapping("/chat.sendMessage")
  public ChatMessageResponse sendMessage(
      @Valid ChatMessageRequest request,
      @Header("simpSessionId") String sessionId,
      Principal principal) {
    Long userId = Long.parseLong(principal.getName());
    return chatWebSocketService.saveAndBroadcast(
        request.getSessionId(), request.getContent(), userId, "USER");
  }

  @MessageExceptionHandler
  @SendToUser("/queue/errors")
  public ChatMessageResponse handleException(
      Exception exception, SimpMessageHeaderAccessor headerAccessor) {
    if (exception instanceof BusinessException be) {
      return ChatMessageResponse.error(be.getCode(), be.getMessage());
    }
    log.error("WebSocket message processing error", exception);
    return ChatMessageResponse.error("INTERNAL_ERROR", "서버 오류가 발생했습니다.");
  }
}
