package com.init.workflowruntime.application.matching;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class WorkflowMatchingJsonParser {

  private static final Logger log = LoggerFactory.getLogger(WorkflowMatchingJsonParser.class);

  private final ObjectMapper objectMapper;
  private final MeterRegistry meterRegistry;

  public WorkflowMatchingJsonParser(ObjectMapper objectMapper, MeterRegistry meterRegistry) {
    this.objectMapper = objectMapper;
    this.meterRegistry = meterRegistry;
  }

  public JsonNode readTreeOrEmptyObject(String json, String source) {
    if (json == null || json.isBlank()) {
      return objectMapper.createObjectNode();
    }
    try {
      return objectMapper.readTree(json);
    } catch (JsonProcessingException e) {
      log.warn(
          "Workflow matching JSON fallback applied. source={}, error={}",
          source,
          e.getOriginalMessage());
      meterRegistry.counter("workflow_matching.json_fallback", "source", source).increment();
      return objectMapper.createObjectNode();
    }
  }
}
