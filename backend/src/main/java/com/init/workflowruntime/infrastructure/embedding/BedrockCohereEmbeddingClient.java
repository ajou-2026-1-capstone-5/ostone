package com.init.workflowruntime.infrastructure.embedding;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.workflowruntime.application.matching.EmbeddingClient;
import com.init.workflowruntime.application.matching.EmbeddingInputType;
import com.init.workflowruntime.application.matching.EmbeddingProperties;
import com.init.workflowruntime.application.matching.VectorUtils;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.io.IOException;
import software.amazon.awssdk.awscore.exception.AwsServiceException;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelRequest;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelResponse;

public class BedrockCohereEmbeddingClient implements EmbeddingClient {

  private static final String COHERE_EMBED_V4_MODEL = "cohere.embed-v4:0";
  private static final String COHERE_EMBED_V4_INFERENCE_PROFILE = "global.cohere.embed-v4:0";

  private final BedrockRuntimeClient client;
  private final ObjectMapper objectMapper;
  private final EmbeddingProperties properties;
  private final MeterRegistry meterRegistry;

  public BedrockCohereEmbeddingClient(
      BedrockRuntimeClient client,
      ObjectMapper objectMapper,
      EmbeddingProperties properties,
      MeterRegistry meterRegistry) {
    this.client = client;
    this.objectMapper = objectMapper;
    this.properties = properties;
    this.meterRegistry = meterRegistry;
  }

  @Override
  public float[] embed(String text, EmbeddingInputType inputType) {
    Timer.Sample sample = Timer.start(meterRegistry);
    try {
      ObjectNode payload = objectMapper.createObjectNode();
      payload.putArray("texts").add(text == null ? "" : text);
      payload.put("input_type", inputType.wireValue());
      if (usesCohereEmbedV4(properties.modelOrDefault())) {
        payload.put("output_dimension", VectorUtils.COHERE_EMBEDDING_DIMENSION);
      }

      InvokeModelResponse response =
          client.invokeModel(
              InvokeModelRequest.builder()
                  .modelId(runtimeModelId(properties.modelOrDefault()))
                  .contentType("application/json")
                  .accept("application/json")
                  .body(SdkBytes.fromUtf8String(objectMapper.writeValueAsString(payload)))
                  .build());

      JsonNode root = objectMapper.readTree(response.body().asUtf8String());
      JsonNode embedding = embeddingNode(root);
      if (!embedding.isArray()) {
        throw new IllegalStateException(
            "Bedrock Cohere embedding response did not contain embeddings[0] or embeddings.float[0]");
      }
      float[] vector = new float[embedding.size()];
      for (int i = 0; i < embedding.size(); i++) {
        vector[i] = (float) embedding.get(i).asDouble();
      }
      meterRegistry.counter("workflow_matching.bedrock.embedding", "result", "success").increment();
      return vector;
    } catch (IOException e) {
      meterRegistry
          .counter("workflow_matching.bedrock.embedding", "result", "serialization_error")
          .increment();
      throw new IllegalStateException("Failed to serialize Bedrock embedding request", e);
    } catch (RuntimeException e) {
      meterRegistry
          .counter(
              "workflow_matching.bedrock.embedding", "result", isThrottle(e) ? "throttle" : "error")
          .increment();
      throw e;
    } finally {
      sample.stop(
          meterRegistry.timer(
              "workflow_matching.bedrock.embedding.latency",
              "model",
              properties.modelOrDefault(),
              "region",
              properties.bedrockRegionOrDefault(),
              "inputType",
              inputType.wireValue()));
    }
  }

  private boolean isThrottle(RuntimeException e) {
    if (e instanceof AwsServiceException awsException) {
      String errorCode =
          awsException.awsErrorDetails() == null ? "" : awsException.awsErrorDetails().errorCode();
      return awsException.statusCode() == 429 || errorCode.toLowerCase().contains("throttl");
    }
    return e.getClass().getSimpleName().toLowerCase().contains("throttl");
  }

  private JsonNode embeddingNode(JsonNode root) {
    JsonNode embeddings = root.path("embeddings");
    if (embeddings.isArray()) {
      return embeddings.path(0);
    }
    return embeddings.path("float").path(0);
  }

  private String runtimeModelId(String model) {
    return COHERE_EMBED_V4_MODEL.equals(model) ? COHERE_EMBED_V4_INFERENCE_PROFILE : model;
  }

  private boolean usesCohereEmbedV4(String model) {
    return COHERE_EMBED_V4_MODEL.equals(model) || COHERE_EMBED_V4_INFERENCE_PROFILE.equals(model);
  }
}
