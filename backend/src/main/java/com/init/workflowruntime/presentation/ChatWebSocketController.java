package com.init.workflowruntime.presentation;

import com.init.shared.application.exception.BusinessException;
import com.init.workflowruntime.application.ChatWebSocketService;
import com.init.workflowruntime.application.dto.ChatMessageRequest;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;

@Controller
public class ChatWebSocketController {

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
  public String handleException(Exception exception, SimpMessageHeaderAccessor headerAccessor) {
    String message;
    if (exception instanceof BusinessException be) {
      message = be.getCode() + ": " + be.getMessage();
    } else {
      message = "INTERNAL_ERROR: " + exception.getMessage();
    }
    return message;
  }
}
