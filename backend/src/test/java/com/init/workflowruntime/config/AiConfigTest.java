package com.init.workflowruntime.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.Map;
import java.util.concurrent.ThreadPoolExecutor;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ChatModel;
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

  @Test
  @DisplayName("chat provider가 openai이면 OpenAI ChatModel로 ChatClient를 구성한다")
  void should_useOpenAiChatModel_when_chatProviderIsOpenAi() {
    AiConfig config = new AiConfig("system prompt");
    ChatModel openAiChatModel = mock(ChatModel.class);

    assertThat(config.chatClient(Map.of("openAiChatModel", openAiChatModel), "openai")).isNotNull();
  }

  @Test
  @DisplayName("chat provider가 bedrock-converse이면 Bedrock Converse ChatModel로 ChatClient를 구성한다")
  void should_useBedrockChatModel_when_chatProviderIsBedrockConverse() {
    AiConfig config = new AiConfig("system prompt");
    ChatModel bedrockChatModel = mock(ChatModel.class);

    assertThat(
            config.chatClient(
                Map.of("bedrockProxyChatModel", bedrockChatModel), "bedrock-converse"))
        .isNotNull();
  }

  @Test
  @DisplayName("선택된 ChatModel bean이 없으면 startup 실패 원인을 명확히 알린다")
  void should_failFast_when_selectedChatModelIsMissing() {
    AiConfig config = new AiConfig("system prompt");
    Map<String, ChatModel> chatModels = Map.of();

    assertThatThrownBy(() -> config.chatClient(chatModels, "bedrock-converse"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessage("ChatModel bean not found: bedrockProxyChatModel");
  }

  @Test
  @DisplayName("system prompt는 비어 있을 수 없다")
  void should_rejectBlankSystemPrompt() {
    assertThatThrownBy(() -> new AiConfig(" "))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessage("systemPrompt must not be null or blank");
  }
}
