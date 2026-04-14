package com.init.domainpack.application;

import com.fasterxml.jackson.annotation.JsonRawValue;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.application.exception.WorkflowGraphJsonInvalidException;
import com.init.domainpack.domain.model.WorkflowDefinition;
import java.io.IOException;
import java.time.OffsetDateTime;

public record WorkflowDefinitionDetail(
    Long id,
    String workflowCode,
    String name,
    String description,
    @JsonRawValue String graphJson,
    String initialState,
    String terminalStatesJson,
    String evidenceJson,
    String metaJson,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  public static WorkflowDefinitionDetail from(WorkflowDefinition entity) {
    validateGraphJson(entity.getGraphJson());
    return new WorkflowDefinitionDetail(
        entity.getId(),
        entity.getWorkflowCode(),
        entity.getName(),
        entity.getDescription(),
        entity.getGraphJson(),
        entity.getInitialState(),
        entity.getTerminalStatesJson(),
        entity.getEvidenceJson(),
        entity.getMetaJson(),
        entity.getCreatedAt(),
        entity.getUpdatedAt());
  }

  private static void validateGraphJson(String graphJson) {
    if (graphJson == null || graphJson.isBlank()) {
      throw new WorkflowGraphJsonInvalidException();
    }
    try {
      JsonNode root = MAPPER.readTree(graphJson);
      if (root == null || !root.isObject()) {
        throw new WorkflowGraphJsonInvalidException();
      }
      JsonNode direction = root.get("direction");
      if (direction == null || !direction.isTextual()) {
        throw new WorkflowGraphJsonInvalidException();
      }
      JsonNode nodes = root.get("nodes");
      if (nodes == null || !nodes.isArray()) {
        throw new WorkflowGraphJsonInvalidException();
      }
      JsonNode edges = root.get("edges");
      if (edges == null || !edges.isArray()) {
        throw new WorkflowGraphJsonInvalidException();
      }
    } catch (WorkflowGraphJsonInvalidException e) {
      throw e;
    } catch (IOException | IllegalArgumentException | NullPointerException e) {
      throw new WorkflowGraphJsonInvalidException(e);
    }
  }
}
