package com.init.workflowruntime.infrastructure.embedding;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.workflowruntime.application.matching.EmbeddingInputType;
import com.init.workflowruntime.application.matching.EmbeddingProperties;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Duration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelRequest;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelResponse;
import software.amazon.awssdk.services.bedrockruntime.model.ThrottlingException;

@ExtendWith(MockitoExtension.class)
@DisplayName("BedrockCohereEmbeddingClient")
class BedrockCohereEmbeddingClientTest {

  @Mock private BedrockRuntimeClient bedrockRuntimeClient;

  @Test
  @DisplayName("embedding 호출 성공/지연 metric을 남긴다")
  void should_recordSuccessAndLatencyMetrics() {
    SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
    BedrockCohereEmbeddingClient client = client(meterRegistry);
    given(bedrockRuntimeClient.invokeModel(any(InvokeModelRequest.class)))
        .willReturn(
            InvokeModelResponse.builder()
                .body(SdkBytes.fromUtf8String("{\"embeddings\":[[0.1,0.2]]}"))
                .build());

    float[] embedding = client.embed("환불하고 싶어요", EmbeddingInputType.SEARCH_QUERY);

    assertThat(embedding).containsExactly(0.1f, 0.2f);
    assertThat(
            meterRegistry
                .counter("workflow_matching.bedrock.embedding", "result", "success")
                .count())
        .isEqualTo(1.0);
    assertThat(meterRegistry.find("workflow_matching.bedrock.embedding.latency").timer())
        .isNotNull();
  }

  @Test
  @DisplayName("Bedrock throttle은 별도 metric으로 남긴다")
  void should_recordThrottleMetric() {
    SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
    BedrockCohereEmbeddingClient client = client(meterRegistry);
    given(bedrockRuntimeClient.invokeModel(any(InvokeModelRequest.class)))
        .willThrow(ThrottlingException.builder().message("rate exceeded").statusCode(429).build());

    assertThatThrownBy(() -> client.embed("환불하고 싶어요", EmbeddingInputType.SEARCH_QUERY))
        .isInstanceOf(ThrottlingException.class);

    assertThat(
            meterRegistry
                .counter("workflow_matching.bedrock.embedding", "result", "throttle")
                .count())
        .isEqualTo(1.0);
  }

  private BedrockCohereEmbeddingClient client(SimpleMeterRegistry meterRegistry) {
    return new BedrockCohereEmbeddingClient(
        bedrockRuntimeClient, new ObjectMapper(), embeddingProperties(), meterRegistry);
  }

  private EmbeddingProperties embeddingProperties() {
    return new EmbeddingProperties(
        "bedrock",
        true,
        "cohere.embed-multilingual-v3",
        "ap-northeast-1",
        Duration.ofSeconds(5),
        Duration.ofSeconds(30),
        Duration.ofMinutes(15),
        Duration.ofMinutes(5),
        30,
        0.70,
        0.72,
        0.55,
        0.10,
        0.65,
        0.50,
        0.30);
  }
}
