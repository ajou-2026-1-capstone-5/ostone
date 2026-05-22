package com.init.workflowruntime.config;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

@Configuration
@EnableAsync
public class AiConfig {

  private final String systemPrompt;

  public AiConfig(@Value("${app.ai.chat.system-prompt}") String systemPrompt) {
    this.systemPrompt = systemPrompt;
  }

  @Bean
  public ChatClient chatClient(ChatClient.Builder builder) {
    return builder
        .defaultSystem(systemPrompt)
        .build();
  }
}
