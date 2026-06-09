package com.init.workflowruntime.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.workflowruntime.domain.InvalidStructuralPatchException;
import com.init.workflowruntime.domain.StructuralDomainPackPatch;
import com.init.workflowruntime.domain.StructuralPatchEvidence;
import com.init.workflowruntime.domain.StructuralPatchOperation;
import com.init.workflowruntime.domain.StructuralPatchOperationType;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * {@code simulation-structural-patch.v1} JSON 문자열을 도메인 value object로 변환한다. JSON 구조/타입 오류와 미지원
 * operation을 fail-closed로 거절하며, 도메인 불변식은 VO compact constructor에 위임한다. 파싱은 어떤 DB 접근도 하지 않는다.
 */
@Component
public class StructuralDomainPackPatchParser {

  private final ObjectMapper objectMapper;

  public StructuralDomainPackPatchParser(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  public StructuralDomainPackPatch parse(String json) {
    if (json == null || json.isBlank()) {
      throw new InvalidStructuralPatchException("patch 문서가 비어 있습니다.");
    }
    JsonNode root = readTree(json);
    if (!root.isObject()) {
      throw new InvalidStructuralPatchException("patch 문서는 JSON object여야 합니다.");
    }

    String schemaVersion = readText(root, "schemaVersion");
    String summary = readText(root, "summary");
    StructuralPatchEvidence evidence = parseEvidence(root.get("evidence"));
    List<StructuralPatchOperation> operations = parseOperations(root.get("operations"));

    return new StructuralDomainPackPatch(schemaVersion, summary, evidence, operations);
  }

  private JsonNode readTree(String json) {
    try {
      return objectMapper.readTree(json);
    } catch (JsonProcessingException e) {
      throw new InvalidStructuralPatchException("patch 문서를 JSON으로 파싱할 수 없습니다.");
    }
  }

  private StructuralPatchEvidence parseEvidence(JsonNode node) {
    if (node == null || node.isNull()) {
      throw new InvalidStructuralPatchException("evidence는 필수입니다.");
    }
    if (!node.isObject()) {
      throw new InvalidStructuralPatchException("evidence는 JSON object여야 합니다.");
    }
    return new StructuralPatchEvidence(
        readLong(node, "feedbackId"),
        readLong(node, "simulationSessionId"),
        readLong(node, "goldenCaseId"),
        readLong(node, "replayResultId"),
        readText(node, "failureSummary"));
  }

  private List<StructuralPatchOperation> parseOperations(JsonNode node) {
    if (node == null || !node.isArray()) {
      throw new InvalidStructuralPatchException("operations는 JSON 배열이어야 합니다.");
    }
    List<StructuralPatchOperation> operations = new ArrayList<>();
    for (JsonNode operationNode : node) {
      operations.add(parseOperation(operationNode));
    }
    return operations;
  }

  private StructuralPatchOperation parseOperation(JsonNode node) {
    if (node == null || !node.isObject()) {
      throw new InvalidStructuralPatchException("operation은 JSON object여야 합니다.");
    }
    String rawOp = readText(node, "op");
    StructuralPatchOperationType type =
        StructuralPatchOperationType.from(rawOp)
            .orElseThrow(
                () -> new InvalidStructuralPatchException("지원하지 않는 operation입니다: " + rawOp));
    String reason = readText(node, "reason");

    return switch (type.getKind()) {
      case ELEMENT -> parseElementOperation(node, type, reason);
      case WORKFLOW_NODE -> parseWorkflowNodeOperation(node, type, reason);
      case WORKFLOW_TRANSITION -> parseWorkflowTransitionOperation(node, type, reason);
    };
  }

  private StructuralPatchOperation parseElementOperation(
      JsonNode node, StructuralPatchOperationType type, String reason) {
    String targetCode = readText(node, type.getCodeFieldName());
    Long targetId = readLong(node, "targetId");
    String value =
        type.getValueFieldName() == null ? null : readText(node, type.getValueFieldName());
    return new StructuralPatchOperation.ElementAttribute(
        type, type.getCategory(), targetCode, targetId, value, reason);
  }

  private StructuralPatchOperation parseWorkflowNodeOperation(
      JsonNode node, StructuralPatchOperationType type, String reason) {
    return new StructuralPatchOperation.WorkflowNode(
        type,
        readText(node, "workflowCode"),
        readLong(node, "workflowDefinitionId"),
        readText(node, "nodeId"),
        readText(node, "nodeType"),
        readText(node, "slotCode"),
        readText(node, "prompt"),
        reason);
  }

  private StructuralPatchOperation parseWorkflowTransitionOperation(
      JsonNode node, StructuralPatchOperationType type, String reason) {
    return new StructuralPatchOperation.WorkflowTransition(
        type,
        readText(node, "workflowCode"),
        readLong(node, "workflowDefinitionId"),
        readText(node, "from"),
        readText(node, "to"),
        readText(node, "condition"),
        reason);
  }

  private String readText(JsonNode node, String field) {
    if (field == null) {
      return null;
    }
    JsonNode value = node.get(field);
    if (value == null || value.isNull() || !value.isTextual()) {
      return null;
    }
    return value.asText();
  }

  private Long readLong(JsonNode node, String field) {
    JsonNode value = node.get(field);
    if (value == null || value.isNull()) {
      return null;
    }
    if (!value.isIntegralNumber()) {
      throw new InvalidStructuralPatchException(field + "는 정수여야 합니다.");
    }
    return value.asLong();
  }
}
