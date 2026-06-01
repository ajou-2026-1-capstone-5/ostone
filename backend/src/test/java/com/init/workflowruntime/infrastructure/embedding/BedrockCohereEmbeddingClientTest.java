package com.init.workflowruntime.infrastructure.embedding;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.workflowruntime.application.matching.EmbeddingInputType;
import com.init.workflowruntime.application.matching.EmbeddingProperties;
import com.init.workflowruntime.application.matching.VectorUtils;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Duration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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
  void should_recordSuccessAndLatencyMetrics() throws Exception {
    SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
    BedrockCohereEmbeddingClient client = client(meterRegistry);
    given(bedrockRuntimeClient.invokeModel(any(InvokeModelRequest.class)))
        .willReturn(
            InvokeModelResponse.builder()
                .body(SdkBytes.fromUtf8String("{\"embeddings\":{\"float\":[[0.1,0.2]]}}"))
                .build());

    float[] embedding = client.embed("환불하고 싶어요", EmbeddingInputType.SEARCH_QUERY);

    assertThat(embedding).containsExactly(0.1f, 0.2f);
    ArgumentCaptor<InvokeModelRequest> requestCaptor =
        ArgumentCaptor.forClass(InvokeModelRequest.class);
    verify(bedrockRuntimeClient).invokeModel(requestCaptor.capture());
    InvokeModelRequest request = requestCaptor.getValue();
    assertThat(request.modelId()).isEqualTo("global.cohere.embed-v4:0");
    JsonNode payload = new ObjectMapper().readTree(request.body().asUtf8String());
    assertThat(payload.path("output_dimension").asInt())
        .isEqualTo(VectorUtils.COHERE_EMBEDDING_DIMENSION);
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

  @Test
  @DisplayName("legacy Cohere 응답 배열과 모델 ID를 그대로 지원한다")
  void should_supportLegacyEmbeddingArrayAndModelId() throws Exception {
    SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
    BedrockCohereEmbeddingClient client =
        new BedrockCohereEmbeddingClient(
            bedrockRuntimeClient,
            new ObjectMapper(),
            embeddingProperties("cohere.embed-multilingual-v3"),
            meterRegistry);
    given(bedrockRuntimeClient.invokeModel(any(InvokeModelRequest.class)))
        .willReturn(
            InvokeModelResponse.builder()
                .body(SdkBytes.fromUtf8String("{\"embeddings\":[[0.3,0.4]]}"))
                .build());

    float[] embedding = client.embed("배송 조회", EmbeddingInputType.SEARCH_DOCUMENT);

    assertThat(embedding).containsExactly(0.3f, 0.4f);
    ArgumentCaptor<InvokeModelRequest> requestCaptor =
        ArgumentCaptor.forClass(InvokeModelRequest.class);
    verify(bedrockRuntimeClient).invokeModel(requestCaptor.capture());
    InvokeModelRequest request = requestCaptor.getValue();
    assertThat(request.modelId()).isEqualTo("cohere.embed-multilingual-v3");
    JsonNode payload = new ObjectMapper().readTree(request.body().asUtf8String());
    assertThat(payload.has("output_dimension")).isFalse();
  }

  @Test
  @DisplayName("embedding 응답에 vector가 없으면 명확히 실패한다")
  void should_fail_when_embeddingResponseDoesNotContainVector() {
    SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
    BedrockCohereEmbeddingClient client = client(meterRegistry);
    given(bedrockRuntimeClient.invokeModel(any(InvokeModelRequest.class)))
        .willReturn(InvokeModelResponse.builder().body(SdkBytes.fromUtf8String("{}")).build());

    assertThatThrownBy(() -> client.embed("환불하고 싶어요", EmbeddingInputType.SEARCH_QUERY))
        .isInstanceOf(IllegalStateException.class)
        .hasMessage(
            "Bedrock Cohere embedding response did not contain embeddings[0] or embeddings.float[0]");
  }

  private BedrockCohereEmbeddingClient client(SimpleMeterRegistry meterRegistry) {
    return new BedrockCohereEmbeddingClient(
        bedrockRuntimeClient, new ObjectMapper(), embeddingProperties(), meterRegistry);
  }

  private EmbeddingProperties embeddingProperties() {
    return embeddingProperties("cohere.embed-v4:0");
  }

  private EmbeddingProperties embeddingProperties(String model) {
    return new EmbeddingProperties(
        "bedrock",
        true,
        model,
        "ap-northeast-2",
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
