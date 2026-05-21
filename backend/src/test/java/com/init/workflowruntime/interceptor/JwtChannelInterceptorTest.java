package com.init.workflowruntime.interceptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import com.init.auth.application.JwtService;
import com.init.shared.application.exception.InvalidTokenException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;

@ExtendWith(MockitoExtension.class)
@DisplayName("JwtChannelInterceptor")
class JwtChannelInterceptorTest {

  @Mock private JwtService jwtService;

  @Mock private MessageChannel channel;

  private JwtChannelInterceptor interceptor;

  @BeforeEach
  void setUp() {
    interceptor = new JwtChannelInterceptor(jwtService);
  }

  @Test
  @DisplayName("CONNECT without Authorization header → MissingAuthHeaderException")
  void should_throwMissingAuthHeaderException_when_noAuthHeader() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

    assertThatThrownBy(() -> interceptor.preSend(message, channel))
        .isInstanceOf(MissingAuthHeaderException.class)
        .hasMessageContaining("Missing or invalid Authorization header");
  }

  @Test
  @DisplayName("CONNECT with invalid JWT → InvalidTokenException")
  void should_throwInvalidTokenException_when_invalidJwt() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
    accessor.setNativeHeader("Authorization", "Bearer invalid-token");
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

    given(jwtService.parseClaims("invalid-token")).willThrow(new JwtException("Invalid token"));

    assertThatThrownBy(() -> interceptor.preSend(message, channel))
        .isInstanceOf(InvalidTokenException.class);
  }

  @Test
  @DisplayName("CONNECT with non-JWT token → InvalidTokenException")
  void should_throwInvalidTokenException_when_invalidTokenFormat() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
    accessor.setNativeHeader("Authorization", "Bearer not-a-jwt-token");
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

    given(jwtService.parseClaims("not-a-jwt-token"))
        .willThrow(new IllegalArgumentException("Not a valid JWT"));

    assertThatThrownBy(() -> interceptor.preSend(message, channel))
        .isInstanceOf(InvalidTokenException.class);
  }

  @Test
  @DisplayName("CONNECT with expired token → InvalidTokenException")
  void should_throwInvalidTokenException_when_expiredToken() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
    accessor.setNativeHeader("Authorization", "Bearer valid-but-expired-token");
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

    Claims claims =
        Jwts.claims().subject("1").add("type", "access").add("role", "OPERATOR").build();
    given(jwtService.parseClaims("valid-but-expired-token")).willReturn(claims);
    given(jwtService.isTokenValid(claims)).willReturn(false);

    assertThatThrownBy(() -> interceptor.preSend(message, channel))
        .isInstanceOf(InvalidTokenException.class)
        .hasMessageContaining("Invalid or expired token");
  }

  @Test
  @DisplayName("CONNECT with valid JWT → Principal set with userId")
  void should_setPrincipal_when_validJwt() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
    accessor.setNativeHeader("Authorization", "Bearer valid-token");
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

    Claims claims =
        Jwts.claims().subject("42").add("type", "access").add("role", "OPERATOR").build();
    given(jwtService.parseClaims("valid-token")).willReturn(claims);
    given(jwtService.isTokenValid(claims)).willReturn(true);
    given(jwtService.isAccessToken(claims)).willReturn(true);

    Message<?> result = interceptor.preSend(message, channel);

    StompHeaderAccessor resultAccessor = StompHeaderAccessor.wrap(result);
    assertThat(resultAccessor.getUser()).isNotNull();
    assertThat(resultAccessor.getUser().getName()).isEqualTo("42");
    assertThat(resultAccessor.getSessionAttributes())
        .containsEntry("userId", 42L)
        .containsEntry("role", "OPERATOR");
  }

  @Test
  @DisplayName("CONNECT with refresh token → InvalidTokenException")
  void should_throwInvalidTokenException_when_refreshToken() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
    accessor.setNativeHeader("Authorization", "Bearer refresh-token");
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

    Claims claims =
        Jwts.claims().subject("1").add("type", "refresh").add("role", "OPERATOR").build();
    given(jwtService.parseClaims("refresh-token")).willReturn(claims);
    given(jwtService.isTokenValid(claims)).willReturn(true);
    given(jwtService.isAccessToken(claims)).willReturn(false);

    assertThatThrownBy(() -> interceptor.preSend(message, channel))
        .isInstanceOf(InvalidTokenException.class)
        .hasMessageContaining("Invalid or expired token");
  }

  @Test
  @DisplayName("Non-CONNECT command → passes through without validation")
  void should_passThrough_when_notConnectCommand() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

    Message<?> result = interceptor.preSend(message, channel);

    assertThat(result).isSameAs(message);
  }
}
