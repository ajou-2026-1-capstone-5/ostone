package com.init.domainpack.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.application.exception.WorkflowGraphJsonInvalidException;
import java.io.IOException;
import java.util.Optional;

public record WorkflowTransitionDetail(
    String id,
    Long workflowDefinitionId,
    Long domainPackVersionId,
    String from,
    String to,
    String label) {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  static Optional<WorkflowTransitionDetail> fromGraphJson(
      String graphJson, String transitionId, Long workflowId, Long versionId) {
    if (graphJson == null) {
      throw new WorkflowGraphJsonInvalidException(
          workflowId, new IllegalArgumentException("graphJson is null"));
    }
    try {
      JsonNode root = MAPPER.readTree(graphJson);
      for (JsonNode e : root.path("edges")) {
        String edgeId = e.hasNonNull("id") ? e.path("id").asText(null) : null;
        if (transitionId.equals(edgeId)) {
          String label = e.hasNonNull("label") ? e.path("label").asText(null) : null;
          return Optional.of(
              new WorkflowTransitionDetail(
                  edgeId,
                  workflowId,
                  versionId,
                  e.path("from").asText(),
                  e.path("to").asText(),
                  label));
        }
      }
      return Optional.empty();
    } catch (IOException | IllegalArgumentException e) {
      throw new WorkflowGraphJsonInvalidException(workflowId, e);
    }
  }
}
