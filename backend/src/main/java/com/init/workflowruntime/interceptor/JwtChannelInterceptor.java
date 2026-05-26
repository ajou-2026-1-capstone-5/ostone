package com.init.workflowruntime.interceptor;

import com.init.auth.application.JwtService;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.InvalidTokenException;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import io.jsonwebtoken.Claims;
import java.util.HashMap;
import java.util.Map;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

@Component
public class JwtChannelInterceptor implements ChannelInterceptor {

  private static final String ROLE_OPERATOR = "OPERATOR";
  private static final String CHAT_TOPIC_PREFIX = "/topic/chat.";

  private final JwtService jwtService;
  private final ChatSessionRepository chatSessionRepository;

  public JwtChannelInterceptor(JwtService jwtService, ChatSessionRepository chatSessionRepository) {
    this.jwtService = jwtService;
    this.chatSessionRepository = chatSessionRepository;
  }

  @Override
  public Message<?> preSend(Message<?> message, MessageChannel channel) {
    StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);

    if (StompCommand.CONNECT.equals(accessor.getCommand())) {
      String authHeader = accessor.getFirstNativeHeader("Authorization");
      if (authHeader == null || !authHeader.startsWith("Bearer ")) {
        throw new MissingAuthHeaderException("Missing or invalid Authorization header");
      }
      String token = authHeader.substring(7);
      Claims claims;
      try {
        claims = jwtService.parseClaims(token);
      } catch (io.jsonwebtoken.JwtException | IllegalArgumentException e) {
        throw new InvalidTokenException("WebSocket 인증 토큰이 유효하지 않습니다.", e);
      }
      if (!jwtService.isTokenValid(claims) || !jwtService.isAccessToken(claims)) {
        throw new InvalidTokenException("INVALID_TOKEN", "Invalid or expired token");
      }
      accessor.setUser(() -> claims.getSubject());
      Map<String, Object> sessionAttrs = accessor.getSessionAttributes();
      if (sessionAttrs == null) {
        sessionAttrs = new HashMap<>();
        accessor.setSessionAttributes(sessionAttrs);
      }
      try {
        sessionAttrs.put("userId", Long.parseLong(claims.getSubject()));
      } catch (NumberFormatException e) {
        throw new InvalidTokenException("토큰 subject가 유효한 사용자 ID가 아닙니다.", e);
      }
      sessionAttrs.put("role", claims.get("role", String.class));
      return MessageBuilder.createMessage(message.getPayload(), accessor.getMessageHeaders());
    } else if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())
        || StompCommand.SEND.equals(accessor.getCommand())) {
      if (accessor.getUser() == null) {
        throw new MissingAuthHeaderException(
            "Authentication required for " + accessor.getCommand());
      }
      if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
        String destination = accessor.getDestination();
        if (destination != null) {
          validateSubscribeDestination(destination, accessor);
        }
      }
    }
    return message;
  }

  private void validateSubscribeDestination(String destination, StompHeaderAccessor accessor) {
    if (destination.startsWith(CHAT_TOPIC_PREFIX)) {
      validateChatTopicSubscription(destination, accessor);
      return;
    }
    if (destination.startsWith("/user/queue/") || destination.startsWith("/queue/")) {
      return;
    }
    throw new BadRequestException(
        "INVALID_DESTINATION", "Unauthorized subscription destination: " + destination);
  }

  private void validateChatTopicSubscription(String destination, StompHeaderAccessor accessor) {
    Long sessionId = parseChatSessionId(destination);
    Long userId = parsePrincipalUserId(accessor);
    String role = sessionRole(accessor);

    if (ROLE_OPERATOR.equals(role)) {
      return;
    }

    ChatSession session =
        chatSessionRepository
            .findById(sessionId)
            .orElseThrow(
                () ->
                    new BadRequestException(
                        "SESSION_NOT_FOUND", "Session not found: " + sessionId));
    if (!userId.equals(session.getStartedBy())) {
      throw new AccessDeniedException(
          "User " + userId + " cannot subscribe to chat session " + sessionId);
    }
  }

  private Long parseChatSessionId(String destination) {
    String rawSessionId = destination.substring(CHAT_TOPIC_PREFIX.length());
    try {
      return Long.valueOf(rawSessionId);
    } catch (NumberFormatException e) {
      throw new BadRequestException(
          "INVALID_DESTINATION", "Invalid chat topic destination: " + destination, e);
    }
  }

  private Long parsePrincipalUserId(StompHeaderAccessor accessor) {
    try {
      return Long.valueOf(accessor.getUser().getName());
    } catch (NumberFormatException e) {
      throw new AccessDeniedException("Invalid authenticated principal", e);
    }
  }

  private String sessionRole(StompHeaderAccessor accessor) {
    Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
    if (sessionAttributes == null) {
      return null;
    }
    Object role = sessionAttributes.get("role");
    return role instanceof String value ? value : null;
  }
}
