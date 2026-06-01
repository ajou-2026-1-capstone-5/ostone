package com.init.workflowruntime.config;

import static org.assertj.core.api.Assertions.assertThat;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.concurrent.ThreadPoolExecutor;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@DisplayName("AiConfig")
class AiConfigTest {

  @Test
  @DisplayName("LLM 자동 응답 executor: 시연 부하 점검용 bounded pool과 queue metric을 구성한다")
  void should_configureBoundedExecutorAndMetrics_when_createLlmAutoResponseExecutor() {
    AiConfig config = new AiConfig("system prompt");
    SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
    LlmAutoResponseProperties properties = new LlmAutoResponseProperties(2, 3, 5, 30);

    ThreadPoolTaskExecutor executor = config.llmAutoResponseTaskExecutor(properties, meterRegistry);

    try {
      ThreadPoolExecutor threadPoolExecutor = executor.getThreadPoolExecutor();

      assertThat(threadPoolExecutor.getCorePoolSize()).isEqualTo(2);
      assertThat(threadPoolExecutor.getMaximumPoolSize()).isEqualTo(3);
      assertThat(threadPoolExecutor.getQueue().remainingCapacity()).isEqualTo(5);
      assertThat(threadPoolExecutor.getRejectedExecutionHandler())
          .isInstanceOf(ThreadPoolExecutor.CallerRunsPolicy.class);
      assertThat(meterRegistry.find("app.ai.chat.auto.response.executor.queue.remaining").gauge())
          .isNotNull();
    } finally {
      executor.shutdown();
    }
  }
}
