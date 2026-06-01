package com.init.workflowruntime.application.matching;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.WorkflowDefinition;
import java.util.LinkedHashSet;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class WorkflowMatchingProfileTextFactory {

  private static final int MAX_PROFILE_TEXT_CHARS = 12_000;
  private final ObjectMapper objectMapper;

  public WorkflowMatchingProfileTextFactory(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  public String build(IntentDefinition intent, WorkflowDefinition workflow) {
    StringBuilder builder = new StringBuilder();
    Set<String> lexicalTerms = new LinkedHashSet<>();

    append(builder, "intent_code", intent.getIntentCode());
    append(builder, "intent_name", intent.getName());
    append(builder, "intent_description", intent.getDescription());
    append(builder, "workflow_code", workflow.getWorkflowCode());
    append(builder, "workflow_name", workflow.getName());
    append(builder, "workflow_description", workflow.getDescription());
    collectText(lexicalTerms, intent.getName(), intent.getDescription());
    collectText(lexicalTerms, workflow.getName(), workflow.getDescription());

    appendIntentEntryTerms(builder, lexicalTerms, intent.getEntryConditionJson());
    appendRouteTerms(builder, lexicalTerms, workflow.getRouteConditionJson());
    appendEvidence(builder, lexicalTerms, "intent_customer_phrases", intent.getEvidenceJson());
    appendEvidence(builder, lexicalTerms, "workflow_customer_phrases", workflow.getEvidenceJson());
    appendWorkflowSteps(builder, lexicalTerms, workflow.getGraphJson());
    appendQualityHints(builder, workflow.getMetaJson());
    appendLexicalTerms(builder, lexicalTerms);

    String text = builder.toString().trim();
    return text.length() <= MAX_PROFILE_TEXT_CHARS
        ? text
        : text.substring(0, MAX_PROFILE_TEXT_CHARS);
  }

  private void append(StringBuilder builder, String label, String value) {
    if (value == null || value.isBlank()) {
      return;
    }
    builder.append(label).append(": ").append(value).append('\n');
  }

  private void appendRouteTerms(StringBuilder builder, Set<String> lexicalTerms, String json) {
    JsonNode route = readTree(json);
    appendArray(builder, lexicalTerms, "route_required_terms", route.path("requiredTerms"));
    appendArray(builder, lexicalTerms, "route_required_any_terms", route.path("requiredAnyTerms"));
    appendArray(builder, lexicalTerms, "route_optional_terms", route.path("optionalTerms"));
    appendArray(builder, lexicalTerms, "route_negative_terms", route.path("negativeTerms"));
  }

  private void appendIntentEntryTerms(
      StringBuilder builder, Set<String> lexicalTerms, String json) {
    JsonNode entry = readTree(json);
    appendArray(builder, lexicalTerms, "intent_entry_required_terms", entry.path("requiredTerms"));
    appendArray(
        builder, lexicalTerms, "intent_entry_required_any_terms", entry.path("requiredAnyTerms"));
    appendArray(builder, lexicalTerms, "intent_entry_optional_terms", entry.path("optionalTerms"));
    appendArray(builder, lexicalTerms, "intent_entry_negative_terms", entry.path("negativeTerms"));
  }

  private void appendEvidence(
      StringBuilder builder, Set<String> lexicalTerms, String label, String json) {
    JsonNode evidence = readTree(json);
    if (!evidence.isArray()) {
      return;
    }
    Set<String> phrases = new LinkedHashSet<>();
    for (JsonNode item : evidence) {
      collectEvidenceText(phrases, item);
    }
    appendJoined(builder, label, phrases);
    phrases.forEach(value -> collectText(lexicalTerms, value));
  }

  private void appendWorkflowSteps(StringBuilder builder, Set<String> lexicalTerms, String json) {
    JsonNode graph = readTree(json);
    Set<String> steps = new LinkedHashSet<>();
    collectWorkflowStepText(steps, graph.path("nodes"));
    collectWorkflowStepText(steps, graph.path("states"));
    appendJoined(builder, "workflow_steps", steps);
    steps.forEach(value -> collectText(lexicalTerms, value));
  }

  private void appendQualityHints(StringBuilder builder, String json) {
    JsonNode meta = readTree(json);
    appendNumber(builder, "workflow_replay_fitness", meta, "workflowReplayFitness");
    appendNumber(builder, "workflow_precision", meta, "workflowPrecision");
    appendNumber(builder, "workflow_confidence", meta, "workflowConfidence");
    appendArray(
        builder, new LinkedHashSet<>(), "workflow_block_reasons", meta.path("blockReasons"));
    appendArray(
        builder,
        new LinkedHashSet<>(),
        "workflow_review_only_reasons",
        meta.path("reviewOnlyReasonCodes"));
  }

  private void appendLexicalTerms(StringBuilder builder, Set<String> lexicalTerms) {
    appendJoined(builder, "lexical_terms", lexicalTerms);
  }

  private void collectEvidenceText(Set<String> phrases, JsonNode item) {
    if (item == null || item.isMissingNode() || item.isNull()) {
      return;
    }
    if (item.isTextual()) {
      addText(phrases, item.asText());
      return;
    }
    if (!item.isObject()) {
      return;
    }
    addText(phrases, textField(item, "customerPhrase"));
    addText(phrases, textField(item, "customerText"));
    addText(phrases, textField(item, "utterance"));
    addText(phrases, textField(item, "quote"));
    addText(phrases, textField(item, "text"));
    addText(phrases, textField(item, "value"));
    addText(phrases, textField(item, "agentAction"));
    addText(phrases, textField(item, "action"));
  }

  private void collectWorkflowStepText(Set<String> steps, JsonNode nodes) {
    if (!nodes.isArray()) {
      return;
    }
    for (JsonNode node : nodes) {
      if (node.isTextual()) {
        addText(steps, node.asText());
        continue;
      }
      addText(steps, textField(node, "id"));
      addText(steps, textField(node, "state"));
      addText(steps, textField(node, "name"));
      addText(steps, textField(node, "label"));
      addText(steps, textField(node, "action"));
      addText(steps, textField(node, "message"));
    }
  }

  private void appendArray(
      StringBuilder builder, Set<String> lexicalTerms, String label, JsonNode values) {
    if (!values.isArray() || values.isEmpty()) {
      return;
    }
    Set<String> texts = new LinkedHashSet<>();
    for (JsonNode value : values) {
      collectTermTexts(texts, value);
    }
    appendJoined(builder, label, texts);
    texts.forEach(value -> collectText(lexicalTerms, value));
  }

  private void collectTermTexts(Set<String> texts, JsonNode value) {
    if (value.isTextual()) {
      addText(texts, value.asText());
      return;
    }
    if (value.isArray()) {
      value.forEach(item -> collectTermTexts(texts, item));
      return;
    }
    if (!value.isObject()) {
      return;
    }
    addText(texts, textField(value, "term"));
    addText(texts, textField(value, "value"));
    collectTermTextArray(texts, value.path("terms"));
    collectTermTextArray(texts, value.path("aliases"));
    collectTermTextArray(texts, value.path("anyOf"));
  }

  private void collectTermTextArray(Set<String> texts, JsonNode values) {
    if (!values.isArray()) {
      return;
    }
    values.forEach(value -> collectTermTexts(texts, value));
  }

  private void appendJoined(StringBuilder builder, String label, Set<String> values) {
    String joined = String.join(", ", values);
    append(builder, label, joined);
  }

  private void appendNumber(StringBuilder builder, String label, JsonNode node, String field) {
    JsonNode value = node.path(field);
    if (value.isNumber()) {
      append(builder, label, value.asText());
    }
  }

  private void collectText(Set<String> terms, String... values) {
    for (String value : values) {
      if (value == null || value.isBlank()) {
        continue;
      }
      for (String token : value.toLowerCase().split("[^0-9a-z가-힣]+")) {
        if (token.length() >= 2) {
          terms.add(token);
        }
      }
    }
  }

  private void addText(Set<String> values, String value) {
    if (value != null && !value.isBlank()) {
      values.add(value.trim());
    }
  }

  private String textField(JsonNode node, String field) {
    JsonNode value = node.path(field);
    return value.isTextual() ? value.asText() : null;
  }

  private JsonNode readTree(String json) {
    if (json == null || json.isBlank()) {
      return objectMapper.createObjectNode();
    }
    try {
      return objectMapper.readTree(json);
    } catch (Exception e) {
      return objectMapper.createObjectNode();
    }
  }
}
