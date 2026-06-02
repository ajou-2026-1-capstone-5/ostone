package com.init.workflowruntime.interceptor;

import com.init.auth.application.JwtService;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.InvalidTokenException;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
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
  private static final String WORKSPACE_QUEUE_TOPIC_PREFIX = "/topic/workspaces.";
  private static final String WORKSPACE_QUEUE_TOPIC_SUFFIX = ".consultation.queue";
  private static final String SESSION_ATTR_ANONYMOUS = "anonymous";
  private static final String USER_ERROR_QUEUE = "/user/queue/errors";

  private final JwtService jwtService;
  private final ChatSessionRepository chatSessionRepository;
  private final WorkspaceMemberRepository workspaceMemberRepository;

  public JwtChannelInterceptor(
      JwtService jwtService,
      ChatSessionRepository chatSessionRepository,
      WorkspaceMemberRepository workspaceMemberRepository) {
    this.jwtService = jwtService;
    this.chatSessionRepository = chatSessionRepository;
    this.workspaceMemberRepository = workspaceMemberRepository;
  }

  @Override
  public Message<?> preSend(Message<?> message, MessageChannel channel) {
    StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
    boolean headersChanged = false;

    if (StompCommand.CONNECT.equals(accessor.getCommand())) {
      String authHeader = accessor.getFirstNativeHeader("Authorization");
      if (authHeader == null || !authHeader.startsWith("Bearer ")) {
        markAnonymousSession(accessor);
        return MessageBuilder.createMessage(message.getPayload(), accessor.getMessageHeaders());
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
      headersChanged = restorePrincipalFromSession(accessor);
      if (accessor.getUser() == null) {
        if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
          validateAnonymousSubscribeDestination(accessor.getDestination(), accessor);
          return headersChanged
              ? MessageBuilder.createMessage(message.getPayload(), accessor.getMessageHeaders())
              : message;
        }
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
    if (headersChanged) {
      return MessageBuilder.createMessage(message.getPayload(), accessor.getMessageHeaders());
    }
    return message;
  }

  private void markAnonymousSession(StompHeaderAccessor accessor) {
    Map<String, Object> sessionAttrs = accessor.getSessionAttributes();
    if (sessionAttrs == null) {
      sessionAttrs = new HashMap<>();
      accessor.setSessionAttributes(sessionAttrs);
    }
    sessionAttrs.put(SESSION_ATTR_ANONYMOUS, true);
  }

  private boolean restorePrincipalFromSession(StompHeaderAccessor accessor) {
    if (accessor.getUser() != null) {
      return false;
    }
    Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
    if (sessionAttributes == null) {
      return false;
    }
    Object userId = sessionAttributes.get("userId");
    if (userId == null) {
      return false;
    }
    accessor.setUser(() -> String.valueOf(userId));
    return true;
  }

  private void validateSubscribeDestination(String destination, StompHeaderAccessor accessor) {
    if (destination.startsWith(CHAT_TOPIC_PREFIX)) {
      validateChatTopicSubscription(destination, accessor);
      return;
    }
    if (destination.startsWith(WORKSPACE_QUEUE_TOPIC_PREFIX)
        && destination.endsWith(WORKSPACE_QUEUE_TOPIC_SUFFIX)) {
      validateWorkspaceQueueSubscription(destination, accessor);
      return;
    }
    if (destination.startsWith("/user/queue/") || destination.startsWith("/queue/")) {
      return;
    }
    throw new BadRequestException(
        "INVALID_DESTINATION", "Unauthorized subscription destination: " + destination);
  }

  private void validateAnonymousSubscribeDestination(
      String destination, StompHeaderAccessor accessor) {
    if (destination == null || destination.isBlank()) {
      throw new BadRequestException("INVALID_DESTINATION", "Subscription destination is required");
    }
    // 익명(데모) 세션이 자기 세션의 서버 에러 큐를 구독하는 것은 허용한다.
    // 프론트엔드 STOMP 클라이언트가 연결 직후 항상 이 큐를 구독하기 때문이다.
    if (USER_ERROR_QUEUE.equals(destination)) {
      return;
    }
    if (!destination.startsWith(CHAT_TOPIC_PREFIX)) {
      throw new MissingAuthHeaderException(
          "Authentication required for subscription destination: " + destination);
    }
    if (!isAnonymousSession(accessor)) {
      throw new MissingAuthHeaderException(
          "Authentication required for subscription destination: " + destination);
    }
    Long sessionId = parseChatSessionId(destination);
    ChatSession session =
        chatSessionRepository
            .findById(sessionId)
            .orElseThrow(
                () ->
                    new BadRequestException(
                        "SESSION_NOT_FOUND", "Session not found: " + sessionId));
    if (session.getStartedBy() != null) {
      throw new MissingAuthHeaderException(
          "Authentication required for chat session: " + sessionId);
    }
  }

  private boolean isAnonymousSession(StompHeaderAccessor accessor) {
    Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
    return sessionAttributes != null
        && Boolean.TRUE.equals(sessionAttributes.get(SESSION_ATTR_ANONYMOUS));
  }

  private void validateChatTopicSubscription(String destination, StompHeaderAccessor accessor) {
    Long sessionId = parseChatSessionId(destination);
    Long userId = parsePrincipalUserId(accessor);
    String role = sessionRole(accessor);

    ChatSession session =
        chatSessionRepository
            .findById(sessionId)
            .orElseThrow(
                () ->
                    new BadRequestException(
                        "SESSION_NOT_FOUND", "Session not found: " + sessionId));

    if (ROLE_OPERATOR.equals(role)) {
      validateWorkspaceMembership(session.getWorkspaceId(), userId);
      return;
    }

    if (!userId.equals(session.getStartedBy())) {
      throw new AccessDeniedException(
          "User " + userId + " cannot subscribe to chat session " + sessionId);
    }
  }

  private void validateWorkspaceQueueSubscription(
      String destination, StompHeaderAccessor accessor) {
    if (!ROLE_OPERATOR.equals(sessionRole(accessor))) {
      throw new AccessDeniedException(
          "Only operators can subscribe to consultation queue topic: " + destination);
    }
    Long workspaceId = parseWorkspaceId(destination);
    Long userId = parsePrincipalUserId(accessor);
    validateWorkspaceMembership(workspaceId, userId);
  }

  private void validateWorkspaceMembership(Long workspaceId, Long userId) {
    workspaceMemberRepository
        .findByWorkspaceIdAndUserId(workspaceId, userId)
        .orElseThrow(
            () ->
                new AccessDeniedException(
                    "User " + userId + " cannot subscribe to workspace " + workspaceId));
  }

  private Long parseWorkspaceId(String destination) {
    String rawWorkspaceId =
        destination.substring(
            WORKSPACE_QUEUE_TOPIC_PREFIX.length(),
            destination.length() - WORKSPACE_QUEUE_TOPIC_SUFFIX.length());
    try {
      return Long.valueOf(rawWorkspaceId);
    } catch (NumberFormatException e) {
      throw new BadRequestException(
          "INVALID_DESTINATION", "Invalid workspace queue destination: " + destination, e);
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
