package com.init.workflowruntime.presentation;

import com.init.shared.application.exception.BusinessException;
import com.init.workflowruntime.application.CounselorService;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.application.dto.CounselorMessageRequest;
import jakarta.validation.Valid;
import java.security.Principal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;

@Controller
public class CounselorWebSocketController {

  private static final Logger log = LoggerFactory.getLogger(CounselorWebSocketController.class);

  private final CounselorService counselorService;

  public CounselorWebSocketController(CounselorService counselorService) {
    this.counselorService = counselorService;
  }

  @MessageMapping("/chat.counselor.send")
  public ChatMessageResponse sendCounselorMessage(
      @Valid CounselorMessageRequest request, Principal principal) {
    Long counselorId = Long.parseLong(principal.getName());
    return counselorService.sendCounselorMessage(
        request.getSessionId(), request.getContent(), counselorId);
  }

  @MessageExceptionHandler
  @SendToUser("/queue/errors")
  public ChatMessageResponse handleException(
      Exception exception, SimpMessageHeaderAccessor headerAccessor) {
    if (exception instanceof BusinessException be) {
      return ChatMessageResponse.error(be.getCode(), be.getMessage());
    }
    log.error("Counselor WebSocket message processing error", exception);
    return ChatMessageResponse.error("INTERNAL_ERROR", "서버 오류가 발생했습니다.");
  }
}
