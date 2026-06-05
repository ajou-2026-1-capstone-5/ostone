package com.init.workflowruntime.application.matching;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.infrastructure.persistence.WorkflowMatchDecisionJdbcRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class WorkflowMatchDecisionRecorder {

  private final EmbeddingProperties properties;
  private final WorkflowMatchDecisionJdbcRepository decisionRepository;
  private final ObjectMapper objectMapper;

  public WorkflowMatchDecisionRecorder(
      EmbeddingProperties properties,
      WorkflowMatchDecisionJdbcRepository decisionRepository,
      ObjectMapper objectMapper) {
    this.properties = properties;
    this.decisionRepository = decisionRepository;
    this.objectMapper = objectMapper;
  }

  public void recordDecision(
      ChatSession session,
      String textHash,
      WorkflowMatchResult result,
      List<WorkflowMatchCandidate> ranked) {
    Optional<WorkflowMatchCandidate> selected =
        "CONFIDENT".equals(result.status())
            ? result.candidates().stream().findFirst()
            : Optional.empty();
    Optional<WorkflowMatchCandidate> top = ranked.stream().findFirst();
    decisionRepository.record(
        session.getId(),
        session.getDomainPackVersionId(),
        selected.map(WorkflowMatchCandidate::workflowDefinitionId).orElse(null),
        selected.map(WorkflowMatchCandidate::intentDefinitionId).orElse(null),
        result.status(),
        top.map(WorkflowMatchCandidate::confidence).orElse(0.0),
        textHash,
        profileVersion(ranked),
        properties.providerOrDefault(),
        properties.modelOrDefault(),
        properties.bedrockRegionOrDefault(),
        thresholdJson(),
        scoreBreakdownJson(top.orElse(null)),
        candidatesJson(ranked),
        failureReason(result, top.orElse(null)));
  }

  public void recordNoCandidate(ChatSession session, String textHash, String reason) {
    decisionRepository.record(
        session.getId(),
        session.getDomainPackVersionId(),
        null,
        null,
        "UNKNOWN",
        0.0,
        textHash,
        null,
        properties.providerOrDefault(),
        properties.modelOrDefault(),
        properties.bedrockRegionOrDefault(),
        thresholdJson(),
        "{}",
        "[]",
        reason);
  }

  public void recordError(ChatSession session, String textHash, RuntimeException e) {
    decisionRepository.record(
        session.getId(),
        session.getDomainPackVersionId(),
        null,
        null,
        "ERROR",
        0.0,
        textHash,
        null,
        properties.providerOrDefault(),
        properties.modelOrDefault(),
        properties.bedrockRegionOrDefault(),
        thresholdJson(),
        "{}",
        "[]",
        e.getClass().getSimpleName());
  }

  private String failureReason(WorkflowMatchResult result, WorkflowMatchCandidate top) {
    if ("CONFIDENT".equals(result.status())) {
      return null;
    }
    if (top != null && top.autoRunBlockReason() != null) {
      return top.autoRunBlockReason();
    }
    if (top != null && top.confusionType() != null) {
      return "confusion_" + top.confusionType();
    }
    if ("AMBIGUOUS".equals(result.status())) {
      return "below_confident_threshold_or_margin";
    }
    if ("UNKNOWN".equals(result.status())) {
      return "below_ambiguous_threshold";
    }
    return null;
  }

  private String thresholdJson() {
    ObjectNode node = objectMapper.createObjectNode();
    node.put("confidentThreshold", properties.confidentThresholdOrDefault());
    node.put("ambiguousThreshold", properties.ambiguousThresholdOrDefault());
    node.put("confidentMargin", properties.confidentMarginOrDefault());
    node.put("semanticFloor", properties.semanticFloorOrDefault());
    node.put("routeEvidenceFloor", properties.routeEvidenceFloorOrDefault());
    node.put("lexicalEvidenceFloor", properties.lexicalEvidenceFloorOrDefault());
    node.put("autoRunReplayFitnessThreshold", properties.autoRunReplayFitnessThresholdOrDefault());
    return node.toString();
  }

  private String scoreBreakdownJson(WorkflowMatchCandidate candidate) {
    ObjectNode node = objectMapper.createObjectNode();
    if (candidate == null) {
      return node.toString();
    }
    node.put("semanticScore", candidate.semanticScore());
    node.put("routeScore", candidate.routeScore());
    node.put("lexicalScore", candidate.lexicalScore());
    node.put("lexicalSearchScore", candidate.lexicalSearchScore());
    node.put("qualityScore", candidate.qualityScore());
    node.put("operationalPriorScore", candidate.operationalPriorScore());
    node.put("confidence", candidate.confidence());
    node.put("autoRunEligible", candidate.autoRunEligible());
    node.put("blocked", candidate.blocked());
    if (candidate.autoRunBlockReason() != null) {
      node.put("autoRunBlockReason", candidate.autoRunBlockReason());
    }
    if (candidate.confusionType() != null) {
      node.put("confusionType", candidate.confusionType());
    }
    return node.toString();
  }

  private String candidatesJson(List<WorkflowMatchCandidate> candidates) {
    ArrayNode array = objectMapper.createArrayNode();
    for (WorkflowMatchCandidate candidate : candidates.stream().limit(5).toList()) {
      ObjectNode node = objectMapper.createObjectNode();
      node.put("workflowDefinitionId", candidate.workflowDefinitionId());
      node.put("intentDefinitionId", candidate.intentDefinitionId());
      node.put("intentCode", candidate.intentCode());
      node.put("workflowCode", candidate.workflowCode());
      node.put("profileVersion", candidate.profileVersion());
      node.put("confidence", candidate.confidence());
      node.put("semanticScore", candidate.semanticScore());
      node.put("routeScore", candidate.routeScore());
      node.put("lexicalScore", candidate.lexicalScore());
      node.put("lexicalSearchScore", candidate.lexicalSearchScore());
      node.put("qualityScore", candidate.qualityScore());
      node.put("operationalPriorScore", candidate.operationalPriorScore());
      node.put("autoRunEligible", candidate.autoRunEligible());
      node.put("blocked", candidate.blocked());
      if (candidate.autoRunBlockReason() != null) {
        node.put("autoRunBlockReason", candidate.autoRunBlockReason());
      }
      if (candidate.confusionType() != null) {
        node.put("confusionType", candidate.confusionType());
      }
      array.add(node);
    }
    return array.toString();
  }

  private String profileVersion(List<WorkflowMatchCandidate> ranked) {
    return ranked.isEmpty() ? null : ranked.get(0).profileVersion();
  }
}
