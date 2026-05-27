package com.init.workflowruntime.presentation;

import static org.assertj.core.api.Assertions.assertThat;

import com.init.auth.application.JwtService;
import java.lang.reflect.Type;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@DisplayName("Chat WebSocket integration")
class ChatWebSocketIntegrationTest {

  @LocalServerPort private int port;

  @Autowired private JwtService jwtService;

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
      session.subscribe(
          "/user/queue/errors",
          new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
              return byte[].class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {}
          });

      Thread.sleep(250);
      assertThat(session.isConnected()).isTrue();
    } finally {
      if (session.isConnected()) {
        session.disconnect();
      }
      stompClient.stop();
    }
  }
}
