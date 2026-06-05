package com.init.workflowruntime.application.matching;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class WorkflowMatchingCore {

  private static final String MATCH_FAILURE_MESSAGE =
      "요청하신 업무를 정확히 확인하지 못했습니다. 어떤 업무인지 조금 더 자세히 알려주세요.";

  private final EmbeddingProperties properties;
  private final WorkflowMatchingJsonParser jsonParser;
  private final WorkflowMatchingTextSignals textSignals;

  public WorkflowMatchingCore(
      EmbeddingProperties properties,
      WorkflowMatchingJsonParser jsonParser,
      WorkflowMatchingTextSignals textSignals) {
    this.properties = properties;
    this.jsonParser = jsonParser;
    this.textSignals = textSignals;
  }

  public WorkflowMatchingEvaluation evaluate(
      List<WorkflowMatchingProfileCandidate> nearest, String redactedText) {
    List<WorkflowMatchCandidate> ranked =
        withConfusionTypes(
            nearest.stream()
                .map(candidate -> rerank(candidate, redactedText))
                .sorted(Comparator.comparing(WorkflowMatchCandidate::confidence).reversed())
                .toList());
    return new WorkflowMatchingEvaluation(decide(ranked), ranked);
  }

  private WorkflowMatchResult decide(List<WorkflowMatchCandidate> ranked) {
    if (ranked.isEmpty()) {
      return WorkflowMatchResult.unknown(MATCH_FAILURE_MESSAGE);
    }
    WorkflowMatchCandidate top = ranked.get(0);
    if (top.blocked()) {
      return WorkflowMatchResult.blocked(MATCH_FAILURE_MESSAGE, ranked.stream().limit(3).toList());
    }
    WorkflowMatchCandidate second = ranked.size() > 1 ? ranked.get(1) : null;
    double margin = second == null ? 1.0 : top.confidence() - second.confidence();
    if (top.confidence() >= properties.confidentThresholdOrDefault()
        && margin >= properties.confidentMarginOrDefault()
        && top.autoRunEligible()) {
      return WorkflowMatchResult.confident(top);
    }
    if (top.confidence() >= properties.ambiguousThresholdOrDefault()) {
      return WorkflowMatchResult.ambiguous(
          buildConfirmationQuestion(ranked), ranked.stream().limit(3).toList());
    }
    return WorkflowMatchResult.unknown(MATCH_FAILURE_MESSAGE);
  }

  private WorkflowMatchCandidate rerank(
      WorkflowMatchingProfileCandidate candidate, String redactedText) {
    RouteScore routeScore =
        routeScore(
            candidate.routeConditionJson(), candidate.intentEntryConditionJson(), redactedText);
    double semanticScore = VectorUtils.clamp01(candidate.semanticScore());
    double lexicalSearchScore = VectorUtils.clamp01(candidate.lexicalSearchScore());
    double lexicalScore =
        Math.max(lexicalScore(candidate.profileText(), redactedText), lexicalSearchScore);
    JsonNode workflowMeta =
        jsonParser.readTreeOrEmptyObject(candidate.workflowMetaJson(), "workflow_meta");
    double qualityScore = qualityScore(candidate.qualityJson(), workflowMeta);
    double operationalPriorScore = VectorUtils.clamp01(candidate.operationalPriorScore());
    boolean workflowQualityEligible = autoRunEligible(workflowMeta);
    String autoRunBlockReason =
        autoRunBlockReason(routeScore, semanticScore, lexicalScore, workflowQualityEligible);
    boolean autoRunEligible = autoRunBlockReason == null;
    double baseConfidence =
        VectorUtils.clamp01(
            (semanticScore * 0.50)
                + (routeScore.score() * 0.20)
                + (lexicalScore * 0.15)
                + (qualityScore * 0.10)
                + (routeScore.confidence() * 0.03)
                + (operationalPriorScore * 0.02));
    double confidence = routeScore.blocked() ? Math.min(baseConfidence, 0.01) : baseConfidence;
    return new WorkflowMatchCandidate(
        candidate.workflowDefinitionId(),
        candidate.intentDefinitionId(),
        candidate.intentCode(),
        candidate.intentName(),
        candidate.workflowCode(),
        candidate.workflowName(),
        candidate.profileVersion(),
        confidence,
        semanticScore,
        routeScore.score(),
        lexicalScore,
        lexicalSearchScore,
        qualityScore,
        operationalPriorScore,
        autoRunEligible,
        routeScore.blocked(),
        autoRunBlockReason,
        null);
  }

  private List<WorkflowMatchCandidate> withConfusionTypes(List<WorkflowMatchCandidate> ranked) {
    if (ranked.isEmpty()) {
      return ranked;
    }
    WorkflowMatchCandidate second = ranked.size() > 1 ? ranked.get(1) : null;
    String topConfusionType = confusionType(ranked.get(0), second);
    return ranked.stream()
        .map(
            candidate ->
                withConfusionType(candidate, candidate == ranked.get(0) ? topConfusionType : null))
        .toList();
  }

  private WorkflowMatchCandidate withConfusionType(
      WorkflowMatchCandidate candidate, String confusionType) {
    if (confusionType == null) {
      return candidate;
    }
    return new WorkflowMatchCandidate(
        candidate.workflowDefinitionId(),
        candidate.intentDefinitionId(),
        candidate.intentCode(),
        candidate.intentName(),
        candidate.workflowCode(),
        candidate.workflowName(),
        candidate.profileVersion(),
        candidate.confidence(),
        candidate.semanticScore(),
        candidate.routeScore(),
        candidate.lexicalScore(),
        candidate.lexicalSearchScore(),
        candidate.qualityScore(),
        candidate.operationalPriorScore(),
        candidate.autoRunEligible(),
        candidate.blocked(),
        candidate.autoRunBlockReason(),
        confusionType);
  }

  private String confusionType(WorkflowMatchCandidate top, WorkflowMatchCandidate second) {
    if (second == null) {
      return null;
    }
    double margin = top.confidence() - second.confidence();
    if (margin >= properties.confidentMarginOrDefault()) {
      return null;
    }
    if (top.intentDefinitionId().equals(second.intentDefinitionId())) {
      return "same_intent_workflow_overlap";
    }
    if (Math.abs(top.semanticScore() - second.semanticScore()) < 0.05
        && Math.abs(top.lexicalScore() - second.lexicalScore()) < 0.10) {
      return "cross_intent_semantic_overlap";
    }
    if (top.semanticScore() >= properties.semanticFloorOrDefault()
        && top.routeScore() < properties.routeEvidenceFloorOrDefault()
        && second.routeScore() >= properties.routeEvidenceFloorOrDefault()) {
      return "semantic_route_conflict";
    }
    return "low_margin";
  }

  private RouteScore routeScore(
      String routeConditionJson, String intentEntryConditionJson, String text) {
    RouteScore route =
        routeScore(jsonParser.readTreeOrEmptyObject(routeConditionJson, "route_condition"), text);
    RouteScore intentEntry =
        routeScore(
            jsonParser.readTreeOrEmptyObject(intentEntryConditionJson, "intent_entry_condition"),
            text);
    if (!route.evidencePresent()) {
      return intentEntry;
    }
    if (!intentEntry.evidencePresent()) {
      return route;
    }
    return new RouteScore(
        VectorUtils.clamp01((route.score() * 0.70) + (intentEntry.score() * 0.30)),
        route.blocked() || intentEntry.blocked(),
        route.requiredSatisfied() && intentEntry.requiredSatisfied(),
        true,
        Math.max(route.confidence(), intentEntry.confidence()));
  }

  private RouteScore routeScore(JsonNode route, String text) {
    if (!route.isObject()) {
      return new RouteScore(0.0, false, true, false, 0.0);
    }
    String normalizedText = textSignals.normalizeForMatch(text);
    if (containsAnyActiveNegative(route.path("negativeTerms"), normalizedText)) {
      return new RouteScore(0.0, true, false, hasRouteTerms(route), routeConfidence(route));
    }
    double required = termGroupCoverage(route.path("requiredTerms"), normalizedText);
    double requiredAny = requiredAnyCoverage(route.path("requiredAnyTerms"), normalizedText);
    double optional = termGroupCoverage(route.path("optionalTerms"), normalizedText);
    boolean hasRequired = hasItems(route.path("requiredTerms"));
    boolean hasRequiredAny = hasItems(route.path("requiredAnyTerms"));
    boolean requiredSatisfied =
        (!hasRequired || required >= 1.0) && (!hasRequiredAny || requiredAny > 0.0);
    double requiredScore =
        hasRequired && hasRequiredAny
            ? (required * 0.70) + (requiredAny * 0.30)
            : Math.max(required, requiredAny);
    double score =
        hasRequired || hasRequiredAny ? (requiredScore * 0.75) + (optional * 0.25) : optional;
    return new RouteScore(
        VectorUtils.clamp01(score),
        false,
        requiredSatisfied,
        hasRouteTerms(route),
        routeConfidence(route));
  }

  private double lexicalScore(String profileText, String text) {
    Set<String> tokens = textSignals.lexicalTokens(text);
    Set<String> profileTokens = textSignals.lexicalTokens(profileText);
    int total = 0;
    int matched = 0;
    for (String token : tokens) {
      total++;
      if (matchesAnyProfileToken(token, profileTokens)) {
        matched++;
      }
    }
    return total == 0 ? 0.0 : VectorUtils.clamp01((double) matched / total);
  }

  private double qualityScore(String qualityJson, JsonNode workflowMeta) {
    JsonNode quality = jsonParser.readTreeOrEmptyObject(qualityJson, "quality");
    double score = quality.path("isPrimary").asBoolean(false) ? 0.7 : 0.5;
    double confidence = workflowMeta.path("workflowConfidence").asDouble(0.0);
    if (confidence > 0.0) {
      score = Math.max(score, confidence);
    }
    return VectorUtils.clamp01(score);
  }

  private String autoRunBlockReason(
      RouteScore routeScore,
      double semanticScore,
      double lexicalScore,
      boolean workflowQualityEligible) {
    if (routeScore.blocked()) {
      return "negative_route_term";
    }
    if (!workflowQualityEligible) {
      return "workflow_quality_gate";
    }
    if (!routeScore.requiredSatisfied()) {
      return "missing_required_route_terms";
    }
    if (semanticScore < properties.semanticFloorOrDefault()) {
      return "semantic_below_floor";
    }
    boolean routeEvidence = routeScore.score() >= properties.routeEvidenceFloorOrDefault();
    boolean lexicalEvidence = lexicalScore >= properties.lexicalEvidenceFloorOrDefault();
    if (!routeEvidence && !lexicalEvidence) {
      return routeScore.evidencePresent() ? "weak_route_evidence" : "insufficient_lexical_evidence";
    }
    return null;
  }

  private boolean autoRunEligible(JsonNode workflowMeta) {
    JsonNode matching = workflowMeta.path("matching");
    if (matching.isObject() && matching.has("autoRunEligible")) {
      return matching.path("autoRunEligible").asBoolean(false);
    }
    if (workflowMeta.has("autoRunEligible")) {
      return workflowMeta.path("autoRunEligible").asBoolean(false);
    }
    return replayQualityEligible(workflowMeta);
  }

  private boolean replayQualityEligible(JsonNode meta) {
    if (meta.path("needsHumanReview").asBoolean(false)
        || meta.path("reviewOnlyCandidate").asBoolean(false)
        || hasItems(meta.path("blockReasons"))
        || hasItems(meta.path("reviewOnlyReasonCodes"))) {
      return false;
    }
    double replayFitness = numeric(meta, "workflowReplayFitness", "workflow_replay_fitness");
    double precision = numeric(meta, "workflowPrecision", "workflow_precision");
    double threshold = properties.autoRunReplayFitnessThresholdOrDefault();
    if (replayFitness <= 0.0) {
      return false;
    }
    return replayFitness >= threshold && (precision <= 0.0 || precision >= 0.55);
  }

  private boolean hasItems(JsonNode node) {
    return node.isArray() && !node.isEmpty();
  }

  private double numeric(JsonNode node, String... fields) {
    for (String field : fields) {
      JsonNode value = node.path(field);
      if (value.isNumber()) {
        return value.asDouble();
      }
    }
    return 0.0;
  }

  private String buildConfirmationQuestion(List<WorkflowMatchCandidate> ranked) {
    if (ranked.size() < 2) {
      return "어떤 업무를 도와드리면 될까요?";
    }
    return "%s와 %s 중 어떤 문의에 가까울까요?"
        .formatted(ranked.get(0).intentName(), ranked.get(1).intentName());
  }

  private boolean containsAnyActiveNegative(JsonNode terms, String normalizedText) {
    for (TermGroup group : termGroups(terms)) {
      for (String term : group.alternatives()) {
        if (matchesTerm(normalizedText, term) && !isNegatedMention(normalizedText, term)) {
          return true;
        }
      }
    }
    return false;
  }

  private double termGroupCoverage(JsonNode terms, String normalizedText) {
    List<TermGroup> groups = termGroups(terms);
    if (groups.isEmpty()) {
      return 0.0;
    }
    long matched = groups.stream().filter(group -> matchesTermGroup(normalizedText, group)).count();
    return (double) matched / groups.size();
  }

  private double requiredAnyCoverage(JsonNode terms, String normalizedText) {
    List<TermGroup> groups = termGroups(terms);
    if (groups.isEmpty()) {
      return 0.0;
    }
    return groups.stream().anyMatch(group -> matchesTermGroup(normalizedText, group)) ? 1.0 : 0.0;
  }

  private boolean matchesTermGroup(String normalizedText, TermGroup group) {
    return group.alternatives().stream().anyMatch(term -> matchesTerm(normalizedText, term));
  }

  private List<TermGroup> termGroups(JsonNode terms) {
    if (!terms.isArray() || terms.isEmpty()) {
      return List.of();
    }
    return java.util.stream.StreamSupport.stream(terms.spliterator(), false)
        .map(this::termGroup)
        .filter(group -> !group.alternatives().isEmpty())
        .toList();
  }

  private TermGroup termGroup(JsonNode node) {
    Set<String> alternatives = new LinkedHashSet<>();
    if (node.isTextual()) {
      addTerm(alternatives, node.asText());
    } else if (node.isArray()) {
      node.forEach(value -> addTerm(alternatives, value.asText("")));
    } else if (node.isObject()) {
      addTerm(alternatives, node.path("term").asText(""));
      addTerm(alternatives, node.path("value").asText(""));
      addTermArray(alternatives, node.path("terms"));
      addTermArray(alternatives, node.path("aliases"));
      addTermArray(alternatives, node.path("anyOf"));
    }
    return new TermGroup(alternatives);
  }

  private void addTermArray(Set<String> terms, JsonNode values) {
    if (!values.isArray()) {
      return;
    }
    values.forEach(value -> addTerm(terms, value.asText("")));
  }

  private void addTerm(Set<String> terms, String value) {
    String normalized = textSignals.normalizeForMatch(value);
    if (normalized.length() >= 2) {
      terms.add(normalized);
    }
  }

  private boolean matchesTerm(String normalizedText, String term) {
    if (term.isBlank()) {
      return false;
    }
    for (String variant : textSignals.lexicalSearchVariants(term)) {
      String normalizedVariant = textSignals.normalizeForMatch(variant);
      if (!normalizedVariant.isBlank() && normalizedText.contains(normalizedVariant)) {
        return true;
      }
    }
    String compactText = normalizedText.replace(" ", "");
    String compactTerm = term.replace(" ", "");
    return compactTerm.length() >= 2 && compactText.contains(compactTerm);
  }

  private boolean isNegatedMention(String normalizedText, String term) {
    int index = normalizedText.indexOf(term);
    while (index >= 0) {
      int from = Math.max(0, index - 8);
      int to = Math.min(normalizedText.length(), index + term.length() + 12);
      String context = normalizedText.substring(from, to).replace(" ", "");
      if (context.contains(term.replace(" ", "") + "말고")
          || context.contains(term.replace(" ", "") + "아니")
          || context.contains(term.replace(" ", "") + "하지않")
          || context.contains(term.replace(" ", "") + "하지마")) {
        return true;
      }
      index = normalizedText.indexOf(term, index + term.length());
    }
    return false;
  }

  private boolean matchesAnyProfileToken(String token, Set<String> profileTokens) {
    for (String profileToken : profileTokens) {
      if (token.equals(profileToken)
          || (token.length() >= 3 && profileToken.startsWith(token))
          || (profileToken.length() >= 2 && token.startsWith(profileToken))) {
        return true;
      }
    }
    return false;
  }

  private boolean hasRouteTerms(JsonNode route) {
    return hasItems(route.path("requiredTerms"))
        || hasItems(route.path("requiredAnyTerms"))
        || hasItems(route.path("optionalTerms"));
  }

  private double routeConfidence(JsonNode route) {
    JsonNode confidence = route.path("confidence");
    if (confidence.isNumber()) {
      return VectorUtils.clamp01(confidence.asDouble());
    }
    return hasRouteTerms(route) ? 0.5 : 0.0;
  }

  private record TermGroup(Set<String> alternatives) {}

  private record RouteScore(
      double score,
      boolean blocked,
      boolean requiredSatisfied,
      boolean evidencePresent,
      double confidence) {}
}
