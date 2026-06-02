package com.init.workflowruntime.infrastructure.embedding;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.workflowruntime.application.matching.EmbeddingClient;
import com.init.workflowruntime.application.matching.EmbeddingInputType;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.client.RestClient;

/**
 * OpenAI 호환 임베딩 클라이언트. {@code /v1/embeddings} 엔드포인트를 호출하며, 벡터 컬럼 차원(1024)에 맞추기 위해 {@code
 * dimensions} 파라미터를 함께 전송한다. Cohere 의 input_type 개념은 OpenAI 에 없으므로 무시한다(문서/질의 모두 동일 모델로 임베딩되어 비교
 * 가능하다).
 */
public class OpenAiEmbeddingClient implements EmbeddingClient {

  private static final Logger log = LoggerFactory.getLogger(OpenAiEmbeddingClient.class);

  private final RestClient restClient;
  private final ObjectMapper objectMapper;
  private final MeterRegistry meterRegistry;
  private final String model;
  private final int dimensions;

  public OpenAiEmbeddingClient(
      RestClient restClient,
      ObjectMapper objectMapper,
      MeterRegistry meterRegistry,
      String model,
      int dimensions) {
    this.restClient = restClient;
    this.objectMapper = objectMapper;
    this.meterRegistry = meterRegistry;
    this.model = model;
    this.dimensions = dimensions;
  }

  @Override
  public float[] embed(String text, EmbeddingInputType inputType) {
    Timer.Sample sample = Timer.start(meterRegistry);
    try {
      Map<String, Object> payload = new LinkedHashMap<>();
      payload.put("model", model);
      payload.put("input", text == null ? "" : text);
      payload.put("dimensions", dimensions);
      payload.put("encoding_format", "float");

      String responseBody =
          restClient.post().uri("/v1/embeddings").body(payload).retrieve().body(String.class);

      JsonNode embedding =
          objectMapper
              .readTree(responseBody == null ? "{}" : responseBody)
              .path("data")
              .path(0)
              .path("embedding");
      if (!embedding.isArray() || embedding.isEmpty()) {
        throw new IllegalStateException(
            "OpenAI embedding response did not contain data[0].embedding");
      }
      float[] vector = new float[embedding.size()];
      for (int i = 0; i < embedding.size(); i++) {
        vector[i] = (float) embedding.get(i).asDouble();
      }
      meterRegistry.counter("workflow_matching.openai.embedding", "result", "success").increment();
      return vector;
    } catch (IOException e) {
      log.warn("OpenAI embedding response parse failed. model={}", model, e);
      meterRegistry
          .counter("workflow_matching.openai.embedding", "result", "serialization_error")
          .increment();
      throw new IllegalStateException("Failed to parse OpenAI embedding response", e);
    } catch (RuntimeException e) {
      log.warn("OpenAI embedding request failed. model={}", model, e);
      meterRegistry.counter("workflow_matching.openai.embedding", "result", "error").increment();
      throw e;
    } finally {
      sample.stop(
          meterRegistry.timer(
              "workflow_matching.openai.embedding.latency",
              "model",
              model,
              "inputType",
              inputType.wireValue()));
    }
  }
}
