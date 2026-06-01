package com.init.workflowruntime.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.ai.chat.auto-response.executor")
public record LlmAutoResponseProperties(
    int coreSize, int maxSize, int queueCapacity, int keepAliveSeconds) {

  public int coreSizeOrDefault() {
    return coreSize <= 0 ? 4 : coreSize;
  }

  public int maxSizeOrDefault() {
    return Math.max(coreSizeOrDefault(), maxSize <= 0 ? 8 : maxSize);
  }

  public int queueCapacityOrDefault() {
    return queueCapacity < 0 ? 16 : queueCapacity;
  }

  public int keepAliveSecondsOrDefault() {
    return keepAliveSeconds <= 0 ? 60 : keepAliveSeconds;
  }
}
