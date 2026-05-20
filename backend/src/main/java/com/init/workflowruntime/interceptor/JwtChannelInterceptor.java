package com.init.workflowruntime.interceptor;

import com.init.auth.application.JwtService;
import com.init.shared.application.exception.InvalidTokenException;
import io.jsonwebtoken.Claims;
import java.util.HashMap;
import java.util.Map;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.stereotype.Component;

@Component
public class JwtChannelInterceptor implements ChannelInterceptor {

  private final JwtService jwtService;

  public JwtChannelInterceptor(JwtService jwtService) {
    this.jwtService = jwtService;
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
      Claims claims = jwtService.parseClaims(token);
      if (!jwtService.isTokenValid(claims) || !jwtService.isAccessToken(claims)) {
        throw new InvalidTokenException("INVALID_TOKEN", "Invalid or expired token");
      }
      accessor.setUser(() -> claims.getSubject());
      Map<String, Object> sessionAttrs = accessor.getSessionAttributes();
      if (sessionAttrs == null) {
        sessionAttrs = new HashMap<>();
        accessor.setSessionAttributes(sessionAttrs);
      }
      sessionAttrs.put("userId", Long.parseLong(claims.getSubject()));
      sessionAttrs.put("role", claims.get("role", String.class));
      return MessageBuilder.createMessage(message.getPayload(), accessor.getMessageHeaders());
    }
    return message;
  }
}
