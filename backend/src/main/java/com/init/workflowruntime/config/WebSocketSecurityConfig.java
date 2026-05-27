package com.init.workflowruntime.config;

import org.springframework.context.annotation.Configuration;

/**
 * STOMP WebSocket 보안 설정입니다. 인증/인가 로직은 {@link
 * com.init.workflowruntime.interceptor.JwtChannelInterceptor}에서 CONNECT, SEND, SUBSCRIBE 프레임 수준으로
 * 처리합니다.
 */
@Configuration
public class WebSocketSecurityConfig {}
