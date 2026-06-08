package com.init.workflowruntime.presentation;

import static org.assertj.core.api.Assertions.assertThat;

import com.init.auth.application.JwtService;
import java.lang.reflect.Type;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.ApplicationListener;
import org.springframework.context.annotation.Bean;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;
import org.springframework.web.socket.messaging.WebSocketStompClient;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@DisplayName("Chat WebSocket integration")
class ChatWebSocketIntegrationTest {

  @LocalServerPort private int port;

  @Autowired private JwtService jwtService;
  @Autowired private SubscriptionTracker subscriptionTracker;

  @Test
  @DisplayName("valid access token으로 STOMP 연결이 수립된다")
  void shouldConnectWithValidAccessToken() throws Exception {
    WebSocketStompClient stompClient = new WebSocketStompClient(new StandardWebSocketClient());
    stompClient.setMessageConverter(new MappingJackson2MessageConverter());

    StompHeaders connectHeaders = new StompHeaders();
    connectHeaders.add(
        "Authorization",
        "Bearer " + jwtService.generateAccessToken(1L, "operator@example.com", "OPERATOR"));

    CompletableFuture<Throwable> transportError = new CompletableFuture<>();
    StompSession session =
        stompClient
            .connectAsync(
                "ws://localhost:" + port + "/ws/chat",
                new WebSocketHttpHeaders(),
                connectHeaders,
                new StompSessionHandlerAdapter() {
                  @Override
                  public void handleTransportError(StompSession session, Throwable exception) {
                    transportError.complete(exception);
                  }
                })
            .get(5, TimeUnit.SECONDS);

    try {
      assertThat(session.isConnected()).isTrue();
      assertThat(transportError).isNotCompleted();
    } finally {
      session.disconnect();
      stompClient.stop();
    }
  }

  @Test
  @DisplayName("연결 후 사용자 queue 구독이 가능하다")
  void shouldSubscribeUserErrorQueueAfterConnect() throws Exception {
    WebSocketStompClient stompClient = new WebSocketStompClient(new StandardWebSocketClient());
    stompClient.setMessageConverter(new MappingJackson2MessageConverter());

    StompHeaders connectHeaders = new StompHeaders();
    connectHeaders.add(
        "Authorization",
        "Bearer " + jwtService.generateAccessToken(1L, "operator@example.com", "OPERATOR"));

    StompSession session =
        stompClient
            .connectAsync(
                "ws://localhost:" + port + "/ws/chat",
                new WebSocketHttpHeaders(),
                connectHeaders,
                new StompSessionHandlerAdapter() {})
            .get(5, TimeUnit.SECONDS);

    try {
      String destination = "/user/queue/errors";
      CompletableFuture<Void> subscribed = subscriptionTracker.expect(destination);
      session.subscribe(
          destination,
          new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
              return byte[].class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {}
          });
      subscribed.get(5, TimeUnit.SECONDS);
      assertThat(session.isConnected()).isTrue();
    } finally {
      if (session.isConnected()) {
        session.disconnect();
      }
      stompClient.stop();
    }
  }

  @TestConfiguration
  static class SubscriptionTrackerConfig {

    @Bean
    SubscriptionTracker subscriptionTracker() {
      return new SubscriptionTracker();
    }

    @Bean
    ApplicationListener<SessionSubscribeEvent> subscriptionTrackerListener(
        SubscriptionTracker tracker) {
      return event -> {
        String destination = SimpMessageHeaderAccessor.wrap(event.getMessage()).getDestination();
        tracker.markSubscribed(destination);
      };
    }
  }

  static class SubscriptionTracker {

    private final ConcurrentHashMap<String, CompletableFuture<Void>> subscriptions =
        new ConcurrentHashMap<>();

    CompletableFuture<Void> expect(String destination) {
      CompletableFuture<Void> subscription = new CompletableFuture<>();
      subscriptions.put(destination, subscription);
      return subscription;
    }

    void markSubscribed(String destination) {
      CompletableFuture<Void> subscription = subscriptions.get(destination);
      if (subscription != null) {
        subscription.complete(null);
      }
    }
  }
}
