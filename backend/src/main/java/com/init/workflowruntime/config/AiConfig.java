package com.init.workflowruntime.config;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.Map;
import java.util.concurrent.ThreadPoolExecutor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
@EnableAsync
@EnableScheduling
@EnableConfigurationProperties(LlmAutoResponseProperties.class)
public class AiConfig {

  public static final String LLM_AUTO_RESPONSE_TASK_EXECUTOR = "llmAutoResponseTaskExecutor";

  private final String systemPrompt;

  public AiConfig(@Value("${app.ai.chat.system-prompt}") String systemPrompt) {
    if (systemPrompt == null || systemPrompt.isBlank()) {
      throw new IllegalArgumentException("systemPrompt must not be null or blank");
    }
    this.systemPrompt = systemPrompt;
  }

  @Bean
  public ChatClient chatClient(
      Map<String, ChatModel> chatModels,
      @Value("${spring.ai.model.chat:openai}") String chatProvider) {
    return ChatClient.builder(chatModel(chatModels, chatProvider))
        .defaultSystem(systemPrompt)
        .build();
  }

  @Bean(name = LLM_AUTO_RESPONSE_TASK_EXECUTOR)
  public ThreadPoolTaskExecutor llmAutoResponseTaskExecutor(
      LlmAutoResponseProperties properties, MeterRegistry meterRegistry) {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(properties.coreSizeOrDefault());
    executor.setMaxPoolSize(properties.maxSizeOrDefault());
    executor.setQueueCapacity(properties.queueCapacityOrDefault());
    executor.setKeepAliveSeconds(properties.keepAliveSecondsOrDefault());
    executor.setThreadNamePrefix("llm-auto-response-");
    executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
    executor.initialize();
    bindLlmAutoResponseExecutorMetrics(executor.getThreadPoolExecutor(), meterRegistry);
    return executor;
  }

  private void bindLlmAutoResponseExecutorMetrics(
      ThreadPoolExecutor executor, MeterRegistry meterRegistry) {
    Gauge.builder(
            "app.ai.chat.auto.response.executor.active",
            executor,
            ThreadPoolExecutor::getActiveCount)
        .register(meterRegistry);
    Gauge.builder(
            "app.ai.chat.auto.response.executor.pool.size",
            executor,
            ThreadPoolExecutor::getPoolSize)
        .register(meterRegistry);
    Gauge.builder(
            "app.ai.chat.auto.response.executor.queue.size",
            executor,
            value -> value.getQueue().size())
        .register(meterRegistry);
    Gauge.builder(
            "app.ai.chat.auto.response.executor.queue.remaining",
            executor,
            value -> value.getQueue().remainingCapacity())
        .register(meterRegistry);
  }

  private ChatModel chatModel(Map<String, ChatModel> chatModels, String chatProvider) {
    String beanName =
        "bedrock-converse".equalsIgnoreCase(chatProvider)
            ? "bedrockProxyChatModel"
            : "openAiChatModel";
    ChatModel chatModel = chatModels.get(beanName);
    if (chatModel == null) {
      throw new IllegalStateException("ChatModel bean not found: " + beanName);
    }
    return chatModel;
  }
}
