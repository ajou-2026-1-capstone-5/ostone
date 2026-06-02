package com.init.workflowruntime.interceptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import com.init.auth.application.JwtService;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.InvalidTokenException;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workspace.domain.model.WorkspaceMember;
import com.init.workspace.domain.model.WorkspaceMemberRole;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
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
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("JwtChannelInterceptor")
class JwtChannelInterceptorTest {

  @Mock private JwtService jwtService;

  @Mock private ChatSessionRepository chatSessionRepository;

  @Mock private WorkspaceMemberRepository workspaceMemberRepository;

  @Mock private MessageChannel channel;

  private JwtChannelInterceptor interceptor;

  @BeforeEach
  void setUp() {
    interceptor =
        new JwtChannelInterceptor(jwtService, chatSessionRepository, workspaceMemberRepository);
  }

  @Test
  @DisplayName("CONNECT without Authorization header → anonymous session allowed")
  void should_allowAnonymousConnect_when_noAuthHeader() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

    Message<?> result = interceptor.preSend(message, channel);

    StompHeaderAccessor resultAccessor = StompHeaderAccessor.wrap(result);
    assertThat(resultAccessor.getUser()).isNull();
    assertThat(resultAccessor.getSessionAttributes()).containsEntry("anonymous", true);
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
  @DisplayName("DISCONNECT command → passes through without validation")
  void should_passThrough_when_notConnectCommand() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.DISCONNECT);
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

    Message<?> result = interceptor.preSend(message, channel);

    assertThat(result).isSameAs(message);
  }

  @Test
  @DisplayName("SUBSCRIBE without authentication → MissingAuthHeaderException")
  void should_throwMissingAuthHeader_when_subscribeWithoutAuth() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
    accessor.setDestination("/topic/workspaces.2.consultation.queue");
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

    assertThatThrownBy(() -> interceptor.preSend(message, channel))
        .isInstanceOf(MissingAuthHeaderException.class);
  }

  @Test
  @DisplayName("SUBSCRIBE without authentication, anonymous demo chat topic → passes through")
  void should_passThrough_when_anonymousSubscribesDemoChatTopic() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
    accessor.setSessionAttributes(new HashMap<>(Map.of("anonymous", true)));
    accessor.setDestination("/topic/chat.1");
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(createSession(1L, null)));

    Message<?> result = interceptor.preSend(message, channel);

    assertThat(result).isSameAs(message);
  }

  @Test
  @DisplayName("SUBSCRIBE without authentication and anonymous marker → MissingAuthHeaderException")
  void should_throwMissingAuthHeader_when_subscribeWithoutAnonymousMarker() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
    accessor.setDestination("/topic/chat.1");
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

    assertThatThrownBy(() -> interceptor.preSend(message, channel))
        .isInstanceOf(MissingAuthHeaderException.class)
        .hasMessageContaining("Authentication required for subscription destination");
  }

  @Test
  @DisplayName(
      "SUBSCRIBE without authentication, user-owned chat topic → MissingAuthHeaderException")
  void should_throwMissingAuthHeader_when_anonymousSubscribesUserOwnedChatTopic() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
    accessor.setSessionAttributes(new HashMap<>(Map.of("anonymous", true)));
    accessor.setDestination("/topic/chat.1");
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(createSession(1L, 42L)));

    assertThatThrownBy(() -> interceptor.preSend(message, channel))
        .isInstanceOf(MissingAuthHeaderException.class)
        .hasMessageContaining("Authentication required for chat session");
  }

  @Test
  @DisplayName("SUBSCRIBE without authentication, anonymous error queue → passes through")
  void should_passThrough_when_anonymousSubscribesUserErrorQueue() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
    accessor.setSessionAttributes(new HashMap<>(Map.of("anonymous", true)));
    accessor.setDestination("/user/queue/errors");
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

    Message<?> result = interceptor.preSend(message, channel);

    assertThat(result).isSameAs(message);
  }

  @Test
  @DisplayName("SUBSCRIBE without authentication, other user queue → MissingAuthHeaderException")
  void should_throwMissingAuthHeader_when_anonymousSubscribesNonErrorUserQueue() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
    accessor.setSessionAttributes(new HashMap<>(Map.of("anonymous", true)));
    accessor.setDestination("/user/queue/messages");
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

    assertThatThrownBy(() -> interceptor.preSend(message, channel))
        .isInstanceOf(MissingAuthHeaderException.class)
        .hasMessageContaining("Authentication required for subscription destination");
  }

  @Test
  @DisplayName("SUBSCRIBE with OPERATOR auth and workspace membership, chat topic → passes through")
  void should_passThrough_when_operatorSubscribesChatTopicWithWorkspaceMembership() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
    accessor.setUser(() -> "42");
    accessor.setSessionAttributes(new HashMap<>(Map.of("role", "OPERATOR")));
    accessor.setDestination("/topic/chat.1");
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(createSession(1L, 2L, 99L)));
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(2L, 42L))
        .willReturn(Optional.of(WorkspaceMember.create(2L, 42L, WorkspaceMemberRole.OPERATOR)));

    Message<?> result = interceptor.preSend(message, channel);

    assertThat(result).isSameAs(message);
  }

  @Test
  @DisplayName(
      "SUBSCRIBE with OPERATOR auth but no workspace membership, chat topic → AccessDeniedException")
  void should_throwAccessDenied_when_operatorSubscribesNonMemberChatTopic() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
    accessor.setUser(() -> "42");
    accessor.setSessionAttributes(new HashMap<>(Map.of("role", "OPERATOR")));
    accessor.setDestination("/topic/chat.1");
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(createSession(1L, 2L, 99L)));
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(2L, 42L))
        .willReturn(Optional.empty());

    assertThatThrownBy(() -> interceptor.preSend(message, channel))
        .isInstanceOf(AccessDeniedException.class);
  }

  @Test
  @DisplayName("SUBSCRIBE with OPERATOR auth, missing chat session → BadRequestException")
  void should_throwBadRequest_when_operatorSubscribesMissingChatSession() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
    accessor.setUser(() -> "42");
    accessor.setSessionAttributes(new HashMap<>(Map.of("role", "OPERATOR")));
    accessor.setDestination("/topic/chat.1");
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    given(chatSessionRepository.findById(1L)).willReturn(Optional.empty());

    assertThatThrownBy(() -> interceptor.preSend(message, channel))
        .isInstanceOfSatisfying(
            BadRequestException.class,
            exception -> assertThat(exception.getCode()).isEqualTo("SESSION_NOT_FOUND"));
  }

  @Test
  @DisplayName(
      "SUBSCRIBE with OPERATOR auth and workspace membership, queue topic → passes through")
  void should_passThrough_when_operatorSubscribesWorkspaceQueueTopic() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
    accessor.setUser(() -> "42");
    accessor.setSessionAttributes(new HashMap<>(Map.of("role", "OPERATOR")));
    accessor.setDestination("/topic/workspaces.2.consultation.queue");
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(2L, 42L))
        .willReturn(Optional.of(WorkspaceMember.create(2L, 42L, WorkspaceMemberRole.OPERATOR)));

    Message<?> result = interceptor.preSend(message, channel);

    assertThat(result).isSameAs(message);
  }

  @Test
  @DisplayName("SUBSCRIBE with non-OPERATOR auth, queue topic → AccessDeniedException")
  void should_throwAccessDenied_when_nonOperatorSubscribesWorkspaceQueueTopic() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
    accessor.setUser(() -> "42");
    accessor.setSessionAttributes(new HashMap<>(Map.of("role", "USER")));
    accessor.setDestination("/topic/workspaces.2.consultation.queue");
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

    assertThatThrownBy(() -> interceptor.preSend(message, channel))
        .isInstanceOf(AccessDeniedException.class);
  }

  @Test
  @DisplayName(
      "SUBSCRIBE with OPERATOR auth but no workspace membership, queue topic → AccessDeniedException")
  void should_throwAccessDenied_when_operatorSubscribesNonMemberWorkspaceQueueTopic() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
    accessor.setUser(() -> "42");
    accessor.setSessionAttributes(new HashMap<>(Map.of("role", "OPERATOR")));
    accessor.setDestination("/topic/workspaces.2.consultation.queue");
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(2L, 42L))
        .willReturn(Optional.empty());

    assertThatThrownBy(() -> interceptor.preSend(message, channel))
        .isInstanceOf(AccessDeniedException.class);
  }

  @Test
  @DisplayName("SUBSCRIBE with invalid workspace queue topic → BadRequestException")
  void should_throwBadRequest_when_workspaceQueueTopicWorkspaceIdInvalid() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
    accessor.setUser(() -> "42");
    accessor.setSessionAttributes(new HashMap<>(Map.of("role", "OPERATOR")));
    accessor.setDestination("/topic/workspaces.bad.consultation.queue");
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

    assertThatThrownBy(() -> interceptor.preSend(message, channel))
        .isInstanceOf(com.init.shared.application.exception.BadRequestException.class);
  }

  @Test
  @DisplayName("SUBSCRIBE restores Principal from session userId")
  void should_restorePrincipalFromSession_when_subscribeWithoutUser() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
    accessor.setSessionAttributes(new HashMap<>(Map.of("userId", 42L, "role", "OPERATOR")));
    accessor.setDestination("/topic/chat.1");
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(createSession(1L, 1L, 99L)));
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 42L))
        .willReturn(Optional.of(WorkspaceMember.create(1L, 42L, WorkspaceMemberRole.OPERATOR)));

    Message<?> result = interceptor.preSend(message, channel);

    StompHeaderAccessor resultAccessor = StompHeaderAccessor.wrap(result);
    assertThat(resultAccessor.getUser()).isNotNull();
    assertThat(resultAccessor.getUser().getName()).isEqualTo("42");
  }

  @Test
  @DisplayName("SUBSCRIBE with USER auth, owned chat topic → passes through")
  void should_passThrough_when_userSubscribesOwnedChatTopic() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
    accessor.setUser(() -> "42");
    accessor.setSessionAttributes(new HashMap<>(Map.of("role", "USER")));
    accessor.setDestination("/topic/chat.1");
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(createSession(1L, 42L)));

    Message<?> result = interceptor.preSend(message, channel);

    assertThat(result).isSameAs(message);
  }

  @Test
  @DisplayName("SUBSCRIBE with USER auth, other user's chat topic → AccessDeniedException")
  void should_throwAccessDenied_when_userSubscribesOtherUsersChatTopic() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
    accessor.setUser(() -> "42");
    accessor.setSessionAttributes(new HashMap<>(Map.of("role", "USER")));
    accessor.setDestination("/topic/chat.1");
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(createSession(1L, 99L)));

    assertThatThrownBy(() -> interceptor.preSend(message, channel))
        .isInstanceOf(AccessDeniedException.class);
  }

  @Test
  @DisplayName("SUBSCRIBE with USER auth, non numeric chat topic → BadRequestException")
  void should_throwBadRequest_when_chatTopicSessionIdInvalid() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
    accessor.setUser(() -> "42");
    accessor.setSessionAttributes(new HashMap<>(Map.of("role", "USER")));
    accessor.setDestination("/topic/chat.queue");
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

    assertThatThrownBy(() -> interceptor.preSend(message, channel))
        .isInstanceOf(com.init.shared.application.exception.BadRequestException.class);
  }

  @Test
  @DisplayName("SUBSCRIBE with auth, invalid destination → BadRequestException")
  void should_throwBadRequest_when_subscribeToUnauthorizedDestination() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
    accessor.setUser(() -> "42");
    accessor.setDestination("/topic/unauthorized");
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

    assertThatThrownBy(() -> interceptor.preSend(message, channel))
        .isInstanceOf(com.init.shared.application.exception.BadRequestException.class);
  }

  @Test
  @DisplayName("SEND with authentication → passes through")
  void should_passThrough_when_sendWithAuth() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SEND);
    accessor.setUser(() -> "42");
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

    Message<?> result = interceptor.preSend(message, channel);

    assertThat(result).isSameAs(message);
  }

  @Test
  @DisplayName("SEND restores Principal from session userId")
  void should_restorePrincipalFromSession_when_sendWithoutUser() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SEND);
    accessor.setSessionAttributes(new HashMap<>(Map.of("userId", 42L)));
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

    Message<?> result = interceptor.preSend(message, channel);

    StompHeaderAccessor resultAccessor = StompHeaderAccessor.wrap(result);
    assertThat(resultAccessor.getUser()).isNotNull();
    assertThat(resultAccessor.getUser().getName()).isEqualTo("42");
  }

  @Test
  @DisplayName("SEND without authentication → MissingAuthHeaderException")
  void should_throwMissingAuthHeader_when_sendWithoutAuth() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SEND);
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

    assertThatThrownBy(() -> interceptor.preSend(message, channel))
        .isInstanceOf(MissingAuthHeaderException.class);
  }

  private ChatSession createSession(Long id, Long startedBy) {
    return createSession(id, 1L, startedBy);
  }

  private ChatSession createSession(Long id, Long workspaceId, Long startedBy) {
    ChatSession session =
        ChatSession.create(workspaceId, 1L, ChatSessionStatus.OPEN, "WEB", "{}", startedBy);
    ReflectionTestUtils.setField(session, "id", id);
    return session;
  }
}
