package com.init.workflowruntime.config;

import com.init.workflowruntime.interceptor.JwtChannelInterceptor;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/** STOMP over WebSocket 브로커 설정입니다. */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

  // STOMP heartbeat 주기(ms). ALB idle timeout(60s)보다 짧은 주기로 양방향 heartbeat가 흐르도록
  // 하여, 유휴 상태의 WebSocket이 끊겨 "실시간 연결에 문제가 있습니다"가 뜨는 것을 방지한다.
  private static final long HEARTBEAT_INTERVAL_MS = 10_000L;

  private final JwtChannelInterceptor jwtChannelInterceptor;
  private final List<String> allowedOrigins;

  // SimpleBroker heartbeat 전용 스케줄러. Spring Boot 기본 TaskScheduler(@Scheduled 공용)와
  // 분리하기 위해 Bean으로 노출하지 않고 직접 생성/초기화한다.
  private final ThreadPoolTaskScheduler heartbeatScheduler = createHeartbeatScheduler();

  public WebSocketConfig(
      JwtChannelInterceptor jwtChannelInterceptor,
      @Value("${cors.allowed-origins}") List<String> allowedOrigins) {
    this.jwtChannelInterceptor = jwtChannelInterceptor;
    this.allowedOrigins = allowedOrigins;
  }

  @Override
  public void configureMessageBroker(MessageBrokerRegistry config) {
    config
        .enableSimpleBroker("/topic", "/queue")
        .setHeartbeatValue(new long[] {HEARTBEAT_INTERVAL_MS, HEARTBEAT_INTERVAL_MS})
        .setTaskScheduler(heartbeatScheduler);
    config.setApplicationDestinationPrefixes("/app");
    config.setUserDestinationPrefix("/user");
  }

  @Override
  public void registerStompEndpoints(StompEndpointRegistry registry) {
    registry
        .addEndpoint("/ws/chat")
        .setAllowedOriginPatterns(allowedOrigins.toArray(String[]::new));
  }

  @Override
  public void configureClientInboundChannel(ChannelRegistration registration) {
    registration.interceptors(jwtChannelInterceptor);
  }

  /** 테스트에서 heartbeat 스케줄러 초기화 여부를 확인하기 위한 접근자입니다. */
  TaskScheduler heartbeatScheduler() {
    return heartbeatScheduler;
  }

  private static ThreadPoolTaskScheduler createHeartbeatScheduler() {
    ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
    scheduler.setPoolSize(1);
    scheduler.setThreadNamePrefix("ws-heartbeat-");
    scheduler.initialize();
    return scheduler;
  }
}
