package com.init.workflowruntime.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.socket.EnableWebSocketSecurity;

/**
 * STOMP WebSocket 보안 설정입니다. {@code @EnableWebSocketSecurity}는 Spring Security의 WebSocket 메시지 인증/인가를
 * 활성화합니다. 구체적인 인증 로직은 {@link com.init.workflowruntime.interceptor.JwtChannelInterceptor}에서 CONNECT
 * 프레임 수준에서 처리합니다.
 */
@Configuration
@EnableWebSocketSecurity
public class WebSocketSecurityConfig {}
