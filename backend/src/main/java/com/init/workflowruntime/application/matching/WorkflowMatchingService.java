package com.init.workflowruntime.application.matching;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.infrastructure.persistence.WorkflowMatchDecisionJdbcRepository;
import com.init.workflowruntime.infrastructure.persistence.WorkflowMatchingProfileJdbcRepository;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.time.Clock;
import java.time.Instant;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

@Service
public class WorkflowMatchingService {

  private static final int MAX_CACHE_SIZE = 1_000;
  private static final String CLARIFICATION_MESSAGE = "어떤 내용으로 문의하시려는지 조금 더 자세히 말씀해 주세요.";
  private static final Set<String> LEXICAL_STOP_WORDS =
      Set.of(
          "고객",
          "고객님",
          "사용자",
          "문의",
          "문의하고",
          "요청",
          "요청하고",
          "확인",
          "확인하고",
          "처리",
          "처리하고",
          "관련",
          "하고",
          "싶어요",
          "합니다",
          "해주세요",
          "가능",
          "가능한가",
          "어떻게",
          "무엇",
          "무슨",
          "어떤",
          "그럼",
          "그리고",
          "근데",
          "상담",
          "도움",
          "도와주세요",
          "가능한가요",
          "가능해요",
          "user",
          "assistant",
          "system",
          "counselor");
  private static final Set<String> LOW_SIGNAL_TERMS =
      Set.of(
          "안녕", "안녕하세요", "안녕하십니까", "하이", "헬로", "hello", "hi", "네", "넵", "예", "응", "음", "아", "오",
          "와", "감사", "감사합니다", "고마워", "고맙습니다");

  private final EmbeddingProperties properties;
  private final EmbeddingClient embeddingClient;
  private final SensitiveTextRedactor redactor;
  private final ChatSessionRepository chatSessionRepository;
  private final WorkflowMatchingProfileJdbcRepository profileRepository;
  private final WorkflowMatchDecisionJdbcRepository decisionRepository;
  private final ObjectMapper objectMapper;
  private final MeterRegistry meterRegistry;
  private final Clock clock;
  private final Map<String, CachedEmbedding> queryEmbeddingCache = new ConcurrentHashMap<>();

  public WorkflowMatchingService(
      EmbeddingProperties properties,
      EmbeddingClient embeddingClient,
      SensitiveTextRedactor redactor,
      ChatSessionRepository chatSessionRepository,
      WorkflowMatchingProfileJdbcRepository profileRepository,
      WorkflowMatchDecisionJdbcRepository decisionRepository,
      ObjectMapper objectMapper,
      MeterRegistry meterRegistry,
      Clock clock) {
    this.properties = properties;
    this.embeddingClient = embeddingClient;
    this.redactor = redactor;
    this.chatSessionRepository = chatSessionRepository;
    this.profileRepository = profileRepository;
    this.decisionRepository = decisionRepository;
    this.objectMapper = objectMapper;
    this.meterRegistry = meterRegistry;
    this.clock = clock;
  }

  public boolean isEnabled() {
    return properties.enabled();
  }

  public WorkflowMatchResult match(
      Long sessionId, String latestUserMessage, String conversationContext) {
    if (!properties.enabled()) {
      return WorkflowMatchResult.unavailable();
    }

    Timer.Sample sample = Timer.start(meterRegistry);
    ChatSession session =
        chatSessionRepository
            .findById(sessionId)
            .orElseThrow(
                () ->
                    new IllegalArgumentException(
                        "Session not found for workflow matching: " + sessionId));
    String redactedText =
        redactor.redact(nullToEmpty(latestUserMessage) + "\n" + nullToEmpty(conversationContext));
    String textHash = VectorUtils.sha256(redactedText);

    try {
      if (lacksIntentSignal(latestUserMessage, conversationContext)) {
        recordNoCandidate(session, textHash, "insufficient_context");
        meterRegistry.counter("workflow_matching.insufficient_context").increment();
        meterRegistry.counter("workflow_matching.result", "status", "UNKNOWN").increment();
        return WorkflowMatchResult.unknown(CLARIFICATION_MESSAGE);
      }

      int activeProfiles = profileRepository.countActiveProfiles(session.getDomainPackVersionId());
      if (activeProfiles == 0) {
        recordNoCandidate(session, textHash, "profile_missing");
        meterRegistry.counter("workflow_matching.profile_missing").increment();
        return WorkflowMatchResult.unknown("아직 이 도메인팩의 매칭 프로필이 준비되지 않았습니다.");
      }

      String embeddingLiteral = VectorUtils.toVectorLiteral(queryEmbedding(textHash, redactedText));
      List<WorkflowMatchingProfileCandidate> nearest =
          profileRepository.findNearestActive(
              session.getDomainPackVersionId(),
              embeddingLiteral,
              lexicalSearchQuery(redactedText),
              properties.topKOrDefault());
      List<WorkflowMatchCandidate> ranked =
          withConfusionTypes(
              nearest.stream()
                  .map(candidate -> rerank(candidate, redactedText))
                  .sorted(Comparator.comparing(WorkflowMatchCandidate::confidence).reversed())
                  .toList());

      WorkflowMatchResult result = decide(ranked);
      recordDecision(session, textHash, result, ranked);
      meterRegistry.counter("workflow_matching.result", "status", result.status()).increment();
      return result;
    } catch (RuntimeException e) {
      recordError(session, textHash, e);
      meterRegistry.counter("workflow_matching.result", "status", "ERROR").increment();
      return WorkflowMatchResult.unknown("요청하신 업무를 정확히 확인하지 못했습니다. 어떤 업무인지 조금 더 자세히 알려주세요.");
    } finally {
      sample.stop(meterRegistry.timer("workflow_matching.match.latency"));
    }
  }

  private boolean lacksIntentSignal(String latestUserMessage, String conversationContext) {
    String latest = normalizeForMatch(latestUserMessage);
    if (latest.isBlank()) {
      return !hasIntentSignal(conversationContext);
    }
    if (isLowSignalUtterance(latest)) {
      return !hasIntentSignal(conversationContext);
    }
    return !hasIntentSignal(latestUserMessage) && !hasIntentSignal(conversationContext);
  }

  private boolean hasIntentSignal(String value) {
    return lexicalTokens(value).stream().anyMatch(token -> !LOW_SIGNAL_TERMS.contains(token));
  }

  private boolean isLowSignalUtterance(String normalizedText) {
    String compact = normalizedText.replace(" ", "");
    if (LOW_SIGNAL_TERMS.contains(compact)) {
      return true;
    }
    Set<String> tokens = rawTokens(normalizedText);
    return !tokens.isEmpty() && tokens.stream().allMatch(LOW_SIGNAL_TERMS::contains);
  }

  private WorkflowMatchResult decide(List<WorkflowMatchCandidate> ranked) {
    if (ranked.isEmpty()) {
      return WorkflowMatchResult.unknown("요청하신 업무를 정확히 확인하지 못했습니다. 어떤 업무인지 조금 더 자세히 알려주세요.");
    }
    WorkflowMatchCandidate top = ranked.get(0);
    if (top.blocked()) {
      return WorkflowMatchResult.blocked(
          "요청하신 업무를 정확히 확인하지 못했습니다. 어떤 업무인지 조금 더 자세히 알려주세요.", ranked.stream().limit(3).toList());
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
    return WorkflowMatchResult.unknown("요청하신 업무를 정확히 확인하지 못했습니다. 어떤 업무인지 조금 더 자세히 알려주세요.");
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
    double qualityScore = qualityScore(candidate.qualityJson(), candidate.workflowMetaJson());
    double operationalPriorScore = VectorUtils.clamp01(candidate.operationalPriorScore());
    boolean workflowQualityEligible = autoRunEligible(candidate.workflowMetaJson());
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
    RouteScore route = routeScore(readTree(routeConditionJson), text);
    RouteScore intentEntry = routeScore(readTree(intentEntryConditionJson), text);
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
    String normalizedText = normalizeForMatch(text);
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
    Set<String> tokens = lexicalTokens(text);
    Set<String> profileTokens = lexicalTokens(profileText);
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

  private double qualityScore(String qualityJson, String workflowMetaJson) {
    JsonNode quality = readTree(qualityJson);
    JsonNode workflowMeta = readTree(workflowMetaJson);
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

  private boolean autoRunEligible(String workflowMetaJson) {
    JsonNode meta = readTree(workflowMetaJson);
    JsonNode matching = meta.path("matching");
    if (matching.isObject() && matching.has("autoRunEligible")) {
      return matching.path("autoRunEligible").asBoolean(false);
    }
    if (meta.has("autoRunEligible")) {
      return meta.path("autoRunEligible").asBoolean(false);
    }
    return replayQualityEligible(meta);
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

  private float[] queryEmbedding(String textHash, String redactedText) {
    Instant now = Instant.now(clock);
    CachedEmbedding cached = queryEmbeddingCache.get(textHash);
    if (cached != null && cached.expiresAt().isAfter(now)) {
      return cached.embedding();
    }
    float[] embedding = embeddingClient.embed(redactedText, EmbeddingInputType.SEARCH_QUERY);
    VectorUtils.requireCohereDimension(embedding);
    if (queryEmbeddingCache.size() > MAX_CACHE_SIZE) {
      queryEmbeddingCache.clear();
    }
    queryEmbeddingCache.put(
        textHash, new CachedEmbedding(embedding, now.plus(properties.queryCacheTtlOrDefault())));
    return embedding;
  }

  private void recordDecision(
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

  private void recordNoCandidate(ChatSession session, String textHash, String reason) {
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

  private void recordError(ChatSession session, String textHash, RuntimeException e) {
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
    String normalized = normalizeForMatch(value);
    if (normalized.length() >= 2) {
      terms.add(normalized);
    }
  }

  private boolean matchesTerm(String normalizedText, String term) {
    if (term.isBlank()) {
      return false;
    }
    for (String variant : lexicalSearchVariants(term)) {
      String normalizedVariant = normalizeForMatch(variant);
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

  private String nullToEmpty(String value) {
    return value == null ? "" : value;
  }

  private Set<String> lexicalTokens(String value) {
    Set<String> tokens = new LinkedHashSet<>();
    Arrays.stream(nullToEmpty(value).toLowerCase(Locale.ROOT).split("[^0-9a-z가-힣]+"))
        .filter(token -> token.length() >= 2)
        .filter(token -> !LEXICAL_STOP_WORDS.contains(token))
        .forEach(tokens::add);
    return tokens;
  }

  private Set<String> rawTokens(String value) {
    Set<String> tokens = new LinkedHashSet<>();
    Arrays.stream(nullToEmpty(value).toLowerCase(Locale.ROOT).split("[^0-9a-z가-힣]+"))
        .filter(token -> !token.isBlank())
        .forEach(tokens::add);
    return tokens;
  }

  private String normalizeForMatch(String value) {
    return nullToEmpty(value)
        .toLowerCase(Locale.ROOT)
        .replaceAll("[^0-9a-z가-힣]+", " ")
        .trim()
        .replaceAll("\\s+", " ");
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

  private String lexicalSearchQuery(String text) {
    return lexicalTokens(text).stream()
        .flatMap(token -> lexicalSearchVariants(token).stream())
        .distinct()
        .limit(12)
        .map(this::quoteWebsearchTerm)
        .reduce((left, right) -> left + " OR " + right)
        .orElse("");
  }

  private Set<String> lexicalSearchVariants(String token) {
    Set<String> variants = new LinkedHashSet<>();
    variants.add(token);
    if (token.endsWith("하고싶어요") && token.length() >= 7) {
      variants.add(token.substring(0, token.length() - 5));
    }
    if (token.endsWith("하고") && token.length() >= 4) {
      variants.add(token.substring(0, token.length() - 2));
    }
    if (token.endsWith("해요") && token.length() >= 4) {
      variants.add(token.substring(0, token.length() - 2));
    }
    if (token.endsWith("합니다") && token.length() >= 5) {
      variants.add(token.substring(0, token.length() - 3));
    }
    return variants;
  }

  private String quoteWebsearchTerm(String term) {
    return "\"" + term.replace("\"", " ") + "\"";
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

  private static final class CachedEmbedding {
    private final float[] embedding;
    private final Instant expiresAt;

    private CachedEmbedding(float[] embedding, Instant expiresAt) {
      this.embedding = embedding;
      this.expiresAt = expiresAt;
    }

    private float[] embedding() {
      return embedding;
    }

    private Instant expiresAt() {
      return expiresAt;
    }
  }

  private record TermGroup(Set<String> alternatives) {}

  private record RouteScore(
      double score,
      boolean blocked,
      boolean requiredSatisfied,
      boolean evidencePresent,
      double confidence) {}
}
