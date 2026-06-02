package com.init.workflowruntime.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.mock;

import com.init.workflowruntime.interceptor.JwtChannelInterceptor;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.SubscribableChannel;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.support.ExecutorSubscribableChannel;

@DisplayName("WebSocketConfig")
class WebSocketConfigTest {

  private final WebSocketConfig config =
      new WebSocketConfig(mock(JwtChannelInterceptor.class), List.of("https://app.example.com"));

  @Test
  @DisplayName("heartbeat 전용 스케줄러가 초기화되어 제공된다")
  void should_initializeHeartbeatScheduler() {
    assertThat(config.heartbeatScheduler()).isNotNull();
  }

  @Test
  @DisplayName("configureMessageBroker는 heartbeat가 설정된 simple broker를 예외 없이 구성한다")
  void should_configureSimpleBrokerWithHeartbeat() {
    SubscribableChannel channel = new ExecutorSubscribableChannel();
    MessageBrokerRegistry registry = new MessageBrokerRegistry(channel, channel);

    assertThatCode(() -> config.configureMessageBroker(registry)).doesNotThrowAnyException();
  }
}
