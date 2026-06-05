package com.init.review.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.shared.application.exception.BadRequestException;
import org.springframework.stereotype.Service;

@Service
public class PipelineReviewCheckpointJsonSupport {

  private final ObjectMapper objectMapper;

  public PipelineReviewCheckpointJsonSupport(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  public ObjectNode objectNode() {
    return objectMapper.createObjectNode();
  }

  public ArrayNode arrayNode() {
    return objectMapper.createArrayNode();
  }

  public JsonNode requireArtifactPayload(JsonNode artifactPayload) {
    if (artifactPayload == null || artifactPayload.isNull()) {
      throw new BadRequestException(
          "CHECKPOINT_ARTIFACT_PAYLOAD_REQUIRED", "artifactPayload는 필수입니다.");
    }
    return artifactPayload;
  }

  public String toJson(JsonNode node) {
    try {
      return objectMapper.writeValueAsString(node);
    } catch (JsonProcessingException ex) {
      throw new IllegalStateException("JSON serialization failed.", ex);
    }
  }

  public JsonNode readJson(String value) {
    try {
      return objectMapper.readTree(value == null || value.isBlank() ? "{}" : value);
    } catch (JsonProcessingException ex) {
      throw new BadRequestException("INVALID_JSON", "JSON payload가 올바르지 않습니다.", ex);
    }
  }

  public String text(JsonNode node, String fieldName) {
    JsonNode value = node.path(fieldName);
    return value.isMissingNode() || value.isNull() ? "" : value.asText("");
  }

  public double number(JsonNode node, String fieldName) {
    JsonNode value = node.path(fieldName);
    return value.isNumber() ? value.asDouble() : 0.0;
  }
}
