package com.init.workflowruntime.application;

import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.dto.IntentCandidate;
import com.init.workflowruntime.application.dto.IntentClassificationResult;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class IntentClassificationService {

  private static final Set<String> STOP_WORDS =
      Set.of("고객", "사용자", "요청", "문의", "확인", "처리", "의도", "하려는", "관련");

  private final ChatSessionRepository chatSessionRepository;
  private final IntentDefinitionRepository intentDefinitionRepository;

  public IntentClassificationService(
      ChatSessionRepository chatSessionRepository,
      IntentDefinitionRepository intentDefinitionRepository) {
    this.chatSessionRepository = chatSessionRepository;
    this.intentDefinitionRepository = intentDefinitionRepository;
  }

  public IntentClassificationResult classify(
      Long sessionId, String latestUserMessage, String conversationContext) {
    ChatSession session = findSession(sessionId);
    String query =
        normalize(nullToEmpty(latestUserMessage) + "\n" + nullToEmpty(conversationContext));

    List<ScoredIntent> scoredIntents =
        intentDefinitionRepository
            .findByDomainPackVersionId(session.getDomainPackVersionId())
            .stream()
            .filter(intent -> !IntentDefinition.STATUS_REJECTED.equals(intent.getStatus()))
            .map(intent -> score(intent, query))
            .sorted(Comparator.comparing(ScoredIntent::score).reversed())
            .toList();

    if (scoredIntents.isEmpty() || scoredIntents.get(0).score() <= 0) {
      return IntentClassificationResult.unknown("요청하신 업무를 정확히 확인하지 못했습니다. 어떤 업무인지 조금 더 자세히 알려주세요.");
    }

    ScoredIntent top = scoredIntents.get(0);
    ScoredIntent second = scoredIntents.size() > 1 ? scoredIntents.get(1) : null;
    List<IntentCandidate> candidates =
        scoredIntents.stream()
            .filter(candidate -> candidate.score() > 0)
            .limit(2)
            .map(this::toCandidate)
            .toList();

    if (second != null && second.score() > 0 && top.score() - second.score() <= 1.0) {
      return IntentClassificationResult.ambiguous(
          buildConfirmationQuestion(candidates), candidates);
    }

    return IntentClassificationResult.confident(
        top.intent().getIntentCode(), confidence(top.score()), List.of(toCandidate(top)));
  }

  private ScoredIntent score(IntentDefinition intent, String query) {
    double score = 0.0;
    String name = normalize(intent.getName());
    if (!name.isBlank() && query.contains(name)) {
      score += 3.0;
    }

    for (String token :
        tokens(intent.getIntentCode() + " " + intent.getName() + " " + intent.getDescription())) {
      if (query.contains(token)) {
        score += token.contains("_") ? 2.0 : 1.0;
      }
    }

    return new ScoredIntent(intent, score);
  }

  private IntentCandidate toCandidate(ScoredIntent scoredIntent) {
    return new IntentCandidate(
        scoredIntent.intent().getIntentCode(),
        scoredIntent.intent().getName(),
        confidence(scoredIntent.score()));
  }

  private String buildConfirmationQuestion(List<IntentCandidate> candidates) {
    if (candidates.size() < 2) {
      return "어떤 업무를 도와드리면 될까요?";
    }
    return "%s와 %s 중 어떤 문의에 가까울까요?".formatted(candidates.get(0).name(), candidates.get(1).name());
  }

  private double confidence(double score) {
    return Math.min(0.95, 0.45 + (score * 0.15));
  }

  private Set<String> tokens(String value) {
    String normalized = normalize(value);
    Set<String> tokens = new LinkedHashSet<>();
    Arrays.stream(normalized.split("[^0-9a-z가-힣]+"))
        .filter(token -> token.length() >= 2)
        .filter(token -> !STOP_WORDS.contains(token))
        .forEach(tokens::add);
    return tokens;
  }

  private String normalize(String value) {
    return nullToEmpty(value).trim().toLowerCase(Locale.ROOT).replace('_', ' ');
  }

  private String nullToEmpty(String value) {
    return value == null ? "" : value;
  }

  private ChatSession findSession(Long sessionId) {
    return chatSessionRepository
        .findById(sessionId)
        .orElseThrow(
            () -> new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + sessionId));
  }

  private record ScoredIntent(IntentDefinition intent, double score) {}
}
