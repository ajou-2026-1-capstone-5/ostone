package com.init.workflowruntime.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.shared.application.exception.BadRequestException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

final class WorkflowConditionEvaluator {

  private WorkflowConditionEvaluator() {}

  static ConditionEvaluation evaluate(JsonNode condition, ConditionContext context) {
    if (isMissingCondition(condition)) {
      return new ConditionEvaluation(false, false);
    }
    if (!condition.isObject()) {
      throw invalidCondition("condition must be an object");
    }

    String type = requiredText(condition, "type");
    return switch (type) {
      case "always" -> new ConditionEvaluation(true, false);
      case "default" -> new ConditionEvaluation(false, true);
      case "slot_present" ->
          new ConditionEvaluation(
              hasSlotValue(context.slotValues(), requiredText(condition, "slotCode")), false);
      case "slot_missing" ->
          new ConditionEvaluation(
              !hasSlotValue(context.slotValues(), requiredText(condition, "slotCode")), false);
      case "slot_equals" ->
          new ConditionEvaluation(slotEquals(context.slotValues(), condition), false);
      case "all" -> new ConditionEvaluation(evaluateAll(condition, context), false);
      case "any" -> new ConditionEvaluation(evaluateAny(condition, context), false);
      case "policy_hit" ->
          new ConditionEvaluation(
              containsCode(context.policySnapshot(), requiredText(condition, "policyCode")), false);
      case "risk_level_gte" ->
          new ConditionEvaluation(
              maxRiskLevel(context.riskSnapshot())
                  >= riskLevelValue(requiredText(condition, "riskLevel")),
              false);
      default -> throw invalidCondition("unsupported condition type: " + type);
    };
  }

  static boolean isDefaultCondition(JsonNode condition) {
    return condition != null
        && condition.isObject()
        && "default".equals(condition.path("type").asText(null));
  }

  static List<String> blockedSlotCodes(
      List<WorkflowRuntimeGraph.RuntimeEdge> edges, ObjectNode slotValues) {
    Set<String> slotCodes = new LinkedHashSet<>();
    for (WorkflowRuntimeGraph.RuntimeEdge edge : edges) {
      collectBlockedSlotCodes(edge.condition(), slotValues, slotCodes);
    }
    return List.copyOf(slotCodes);
  }

  static List<String> blockedSlotCodes(JsonNode condition, ObjectNode slotValues) {
    Set<String> slotCodes = new LinkedHashSet<>();
    collectBlockedSlotCodes(condition, slotValues, slotCodes);
    return List.copyOf(slotCodes);
  }

  private static boolean evaluateAll(JsonNode condition, ConditionContext context) {
    List<JsonNode> conditions = requiredConditionArray(condition);
    for (JsonNode child : conditions) {
      ConditionEvaluation result = evaluate(child, context);
      if (result.defaultCondition() || !result.matched()) {
        return false;
      }
    }
    return true;
  }

  private static boolean evaluateAny(JsonNode condition, ConditionContext context) {
    List<JsonNode> conditions = requiredConditionArray(condition);
    for (JsonNode child : conditions) {
      ConditionEvaluation result = evaluate(child, context);
      if (!result.defaultCondition() && result.matched()) {
        return true;
      }
    }
    return false;
  }

  private static boolean slotEquals(ObjectNode slotValues, JsonNode condition) {
    String slotCode = requiredText(condition, "slotCode");
    if (!hasSlotValue(slotValues, slotCode) || !condition.has("value")) {
      return false;
    }
    return slotValues.get(slotCode).equals(condition.get("value"));
  }

  private static void collectBlockedSlotCodes(
      JsonNode condition, ObjectNode slotValues, Set<String> slotCodes) {
    if (isMissingCondition(condition) || !condition.isObject()) {
      return;
    }
    String type = condition.path("type").asText(null);
    if ("slot_present".equals(type) || "slot_equals".equals(type)) {
      String slotCode = condition.path("slotCode").asText(null);
      if (slotCode != null && !slotCode.isBlank() && !hasSlotValue(slotValues, slotCode)) {
        slotCodes.add(slotCode);
      }
      return;
    }
    if ("all".equals(type) || "any".equals(type)) {
      for (JsonNode child : condition.path("conditions")) {
        collectBlockedSlotCodes(child, slotValues, slotCodes);
      }
    }
  }

  private static boolean hasSlotValue(ObjectNode slotValues, String slotCode) {
    if (!slotValues.hasNonNull(slotCode)) {
      return false;
    }
    JsonNode value = slotValues.get(slotCode);
    if (value.isTextual()) {
      return !value.asText().isBlank();
    }
    if (value.isArray() || value.isObject()) {
      return !value.isEmpty();
    }
    return true;
  }

  private static boolean containsCode(JsonNode node, String code) {
    if (node == null || node.isNull() || node.isMissingNode()) {
      return false;
    }
    if (node.isTextual()) {
      return code.equals(node.asText());
    }
    if (node.isArray()) {
      for (JsonNode child : node) {
        if (containsCode(child, code)) {
          return true;
        }
      }
      return false;
    }
    if (!node.isObject()) {
      return false;
    }
    if (code.equals(node.path("policyCode").asText(null))
        || code.equals(node.path("code").asText(null))) {
      return true;
    }
    return containsCode(node.path("hits"), code) || containsCode(node.path("policyHits"), code);
  }

  private static int maxRiskLevel(JsonNode node) {
    if (node == null || node.isNull() || node.isMissingNode()) {
      return 0;
    }
    if (node.isTextual()) {
      return riskLevelValue(node.asText());
    }
    if (node.isArray()) {
      int max = 0;
      for (JsonNode child : node) {
        max = Math.max(max, maxRiskLevel(child));
      }
      return max;
    }
    if (!node.isObject()) {
      return 0;
    }
    int current =
        Math.max(
            riskLevelValue(node.path("riskLevel").asText(null)),
            riskLevelValue(node.path("level").asText(null)));
    return Math.max(
        current, Math.max(maxRiskLevel(node.path("hits")), maxRiskLevel(node.path("riskHits"))));
  }

  private static int riskLevelValue(String riskLevel) {
    if (riskLevel == null || riskLevel.isBlank()) {
      return 0;
    }
    return switch (riskLevel.trim().toUpperCase(Locale.ROOT)) {
      case "LOW" -> 1;
      case "MEDIUM" -> 2;
      case "HIGH" -> 3;
      case "CRITICAL" -> 4;
      default -> throw invalidCondition("unsupported risk level: " + riskLevel);
    };
  }

  private static List<JsonNode> requiredConditionArray(JsonNode condition) {
    JsonNode children = condition.path("conditions");
    if (!children.isArray() || children.isEmpty()) {
      throw invalidCondition("conditions must be a non-empty array");
    }
    List<JsonNode> result = new ArrayList<>();
    children.forEach(result::add);
    return result;
  }

  private static String requiredText(JsonNode condition, String fieldName) {
    String value = condition.path(fieldName).asText(null);
    if (value == null || value.isBlank()) {
      throw invalidCondition(fieldName + " is required");
    }
    return value.trim();
  }

  private static boolean isMissingCondition(JsonNode condition) {
    return condition == null || condition.isNull() || condition.isMissingNode();
  }

  private static BadRequestException invalidCondition(String message) {
    return new BadRequestException("WORKFLOW_CONDITION_INVALID", message);
  }

  record ConditionContext(ObjectNode slotValues, JsonNode policySnapshot, JsonNode riskSnapshot) {}

  record ConditionEvaluation(boolean matched, boolean defaultCondition) {}
}
