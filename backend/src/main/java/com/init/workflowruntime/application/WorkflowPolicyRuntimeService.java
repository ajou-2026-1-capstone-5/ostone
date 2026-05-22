package com.init.workflowruntime.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.domainpack.domain.model.PolicyDefinition;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.InternalException;
import com.init.workflowruntime.application.WorkflowConditionEvaluator.ConditionContext;
import com.init.workflowruntime.application.WorkflowConditionEvaluator.ConditionEvaluation;
import com.init.workflowruntime.application.WorkflowRuntimeGraph.RuntimeNode;
import com.init.workflowruntime.application.dto.LlmToolPolicyResponse;
import com.init.workflowruntime.domain.WorkflowExecution;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class WorkflowPolicyRuntimeService {

  private final PolicyDefinitionRepository policyDefinitionRepository;
  private final WorkflowDefinitionRepository workflowDefinitionRepository;
  private final ObjectMapper objectMapper;

  public WorkflowPolicyRuntimeService(
      PolicyDefinitionRepository policyDefinitionRepository,
      WorkflowDefinitionRepository workflowDefinitionRepository,
      ObjectMapper objectMapper) {
    this.policyDefinitionRepository = policyDefinitionRepository;
    this.workflowDefinitionRepository = workflowDefinitionRepository;
    this.objectMapper = objectMapper;
  }

  public LlmToolPolicyResponse evaluateCurrentPolicy(
      Long domainPackVersionId, WorkflowExecution execution, ObjectNode slotValues) {
    RuntimeNode currentNode = resolveCurrentNode(domainPackVersionId, execution);
    if (currentNode == null) {
      return null;
    }
    return evaluateNodePolicy(
        new PolicyEvaluationCommand(domainPackVersionId, currentNode, slotValues, execution));
  }

  LlmToolPolicyResponse evaluateNodePolicy(PolicyEvaluationCommand command) {
    Long domainPackVersionId = command.domainPackVersionId();
    RuntimeNode node = command.node();
    ObjectNode slotValues = command.slotValues();
    WorkflowExecution execution = command.execution();
    String policyRef = trimToNull(node.policyRef());
    if (policyRef == null) {
      return null;
    }

    PolicyDefinition policy =
        policyDefinitionRepository
            .findByDomainPackVersionIdAndPolicyCode(domainPackVersionId, policyRef)
            .orElseThrow(
                () ->
                    new BadRequestException(
                        "POLICY_DEFINITION_NOT_FOUND", "PolicyDefinition not found: " + policyRef));
    JsonNode condition = readJsonNode(policy.getConditionJson(), "{}");
    JsonNode action = readJsonNode(policy.getActionJson(), "{}");
    JsonNode evidence = readJsonNode(policy.getEvidenceJson(), "[]");
    JsonNode meta = readJsonNode(policy.getMetaJson(), "{}");
    PolicyEvaluation evaluation = evaluatePolicyCondition(condition, slotValues, execution);

    return new LlmToolPolicyResponse(
        policy.getId(),
        policy.getPolicyCode(),
        policy.getName(),
        policy.getDescription(),
        policy.getSeverity(),
        condition,
        action,
        evidence,
        meta,
        policy.getStatus(),
        node.id(),
        evaluation.matched(),
        evaluation.missingSlotCodes(),
        evaluation.reason());
  }

  public JsonNode buildPolicySnapshot(LlmToolPolicyResponse currentPolicy) {
    ObjectNode snapshot = objectMapper.createObjectNode();
    if (currentPolicy == null) {
      snapshot.set("hits", objectMapper.createArrayNode());
      return snapshot;
    }

    ObjectNode policyNode = objectMapper.createObjectNode();
    policyNode.put("policyCode", currentPolicy.policyCode());
    policyNode.put("name", currentPolicy.name());
    policyNode.put("severity", currentPolicy.severity());
    policyNode.put("nodeId", currentPolicy.nodeId());
    policyNode.put("matched", currentPolicy.matched());
    policyNode.set("missingSlotCodes", objectMapper.valueToTree(currentPolicy.missingSlotCodes()));
    policyNode.set("condition", currentPolicy.condition());
    policyNode.set("action", currentPolicy.action());
    policyNode.set("evidence", currentPolicy.evidence());

    snapshot.set("currentPolicy", policyNode);
    ArrayNode hits = objectMapper.createArrayNode();
    if (currentPolicy.matched()) {
      ObjectNode hit = objectMapper.createObjectNode();
      hit.put("policyCode", currentPolicy.policyCode());
      hit.put("nodeId", currentPolicy.nodeId());
      hits.add(hit);
    }
    snapshot.set("hits", hits);
    return snapshot;
  }

  private RuntimeNode resolveCurrentNode(Long domainPackVersionId, WorkflowExecution execution) {
    if (execution == null
        || execution.getWorkflowDefinitionId() == null
        || trimToNull(execution.getCurrentState()) == null) {
      return null;
    }
    WorkflowDefinition workflow =
        workflowDefinitionRepository
            .findByIdAndDomainPackVersionId(
                execution.getWorkflowDefinitionId(), domainPackVersionId)
            .orElse(null);
    if (workflow == null) {
      return null;
    }
    WorkflowRuntimeGraph graph =
        WorkflowRuntimeGraph.parse(objectMapper, workflow.getGraphJson(), workflow.getId());
    return graph.findNode(execution.getCurrentState());
  }

  private PolicyEvaluation evaluatePolicyCondition(
      JsonNode condition, ObjectNode slotValues, WorkflowExecution execution) {
    if (!hasExecutableCondition(condition)) {
      return new PolicyEvaluation(true, List.of(), "policy has no condition");
    }
    JsonNode policySnapshot = readJsonNode(execution.getPolicySnapshotJson(), "{}");
    JsonNode riskSnapshot = readJsonNode(execution.getRiskSnapshotJson(), "{}");
    ConditionEvaluation result =
        WorkflowConditionEvaluator.evaluate(
            condition, new ConditionContext(slotValues, policySnapshot, riskSnapshot));
    List<String> missingSlotCodes =
        result.matched()
            ? List.of()
            : WorkflowConditionEvaluator.blockedSlotCodes(condition, slotValues);
    return new PolicyEvaluation(
        result.matched(),
        missingSlotCodes,
        result.matched() ? "policy condition matched" : "policy condition not matched");
  }

  private boolean hasExecutableCondition(JsonNode condition) {
    return condition != null
        && condition.isObject()
        && condition.hasNonNull("type")
        && !condition.path("type").asText().isBlank();
  }

  private JsonNode readJsonNode(String json, String defaultJson) {
    String source = trimToNull(json);
    if (source == null) {
      source = defaultJson;
    }
    try {
      return objectMapper.readTree(source);
    } catch (JsonProcessingException e) {
      throw new InternalException("JSON_PARSE_FAILED", "Stored JSON value cannot be parsed", e);
    }
  }

  private String trimToNull(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  private record PolicyEvaluation(boolean matched, List<String> missingSlotCodes, String reason) {}
}
