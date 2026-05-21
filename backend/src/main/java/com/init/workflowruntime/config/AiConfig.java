package com.init.workflowruntime.config;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

@Configuration
@EnableAsync
public class AiConfig {

  @Bean
  public ChatClient chatClient(ChatClient.Builder builder) {
    return builder
        .defaultSystem(
            """
            당신은 고객상담 어시스턴트입니다.
            친절하고 정확하게 답변해주세요.
            """)
        .build();
  }
}
