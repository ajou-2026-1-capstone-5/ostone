package com.init.workflowruntime.application.matching;

import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import io.micrometer.core.instrument.Timer;
import org.springframework.stereotype.Service;

@Service
public class WorkflowMatchingService {

  private static final String CLARIFICATION_MESSAGE = "어떤 내용으로 문의하시려는지 조금 더 자세히 말씀해 주세요.";
  private static final String MATCH_FAILURE_MESSAGE =
      "요청하신 업무를 정확히 확인하지 못했습니다. 어떤 업무인지 조금 더 자세히 알려주세요.";

  private final EmbeddingProperties properties;
  private final SensitiveTextRedactor redactor;
  private final ChatSessionRepository chatSessionRepository;
  private final WorkflowMatchingProfileCandidateProvider candidateProvider;
  private final WorkflowMatchingCore matchingCore;
  private final WorkflowMatchDecisionRecorder decisionRecorder;
  private final WorkflowMatchingMetrics metrics;
  private final WorkflowMatchingTextSignals textSignals;

  public WorkflowMatchingService(
      EmbeddingProperties properties,
      SensitiveTextRedactor redactor,
      ChatSessionRepository chatSessionRepository,
      WorkflowMatchingProfileCandidateProvider candidateProvider,
      WorkflowMatchingCore matchingCore,
      WorkflowMatchDecisionRecorder decisionRecorder,
      WorkflowMatchingMetrics metrics,
      WorkflowMatchingTextSignals textSignals) {
    this.properties = properties;
    this.redactor = redactor;
    this.chatSessionRepository = chatSessionRepository;
    this.candidateProvider = candidateProvider;
    this.matchingCore = matchingCore;
    this.decisionRecorder = decisionRecorder;
    this.metrics = metrics;
    this.textSignals = textSignals;
  }

  public boolean isEnabled() {
    return properties.enabled();
  }

  public WorkflowMatchResult match(
      Long sessionId, String latestUserMessage, String conversationContext) {
    if (!properties.enabled()) {
      return WorkflowMatchResult.unavailable();
    }

    Timer.Sample sample = metrics.startMatchTimer();
    ChatSession session =
        chatSessionRepository
            .findById(sessionId)
            .orElseThrow(
                () ->
                    new IllegalArgumentException(
                        "Session not found for workflow matching: " + sessionId));
    String redactedText =
        redactor.redact(
            textSignals.nullToEmpty(latestUserMessage)
                + "\n"
                + textSignals.nullToEmpty(conversationContext));
    String textHash = VectorUtils.sha256(redactedText);

    try {
      if (textSignals.lacksIntentSignal(latestUserMessage, conversationContext)) {
        decisionRecorder.recordNoCandidate(session, textHash, "insufficient_context");
        metrics.recordInsufficientContext();
        return WorkflowMatchResult.unknown(CLARIFICATION_MESSAGE);
      }

      if (!candidateProvider.hasActiveProfiles(session.getDomainPackVersionId())) {
        decisionRecorder.recordNoCandidate(session, textHash, "profile_missing");
        metrics.recordProfileMissing();
        // 임베딩 매칭 프로필이 아직 없으면 임베딩 매칭을 dead-end(UNKNOWN) 로 끝내지 않고 UNAVAILABLE 로
        // 반환한다. 그래야 IntentClassificationService 가 키워드 기반 폴백 분류를 수행한다. (시드 도메인팩은
        // prod 에서 profile build 를 의도적으로 건너뛰므로, 프로필이 없을 때 키워드 매칭으로 우아하게 저하한다.)
        return WorkflowMatchResult.unavailable();
      }

      WorkflowMatchingEvaluation evaluation =
          matchingCore.evaluate(
              candidateProvider.findCandidates(
                  session.getDomainPackVersionId(), textHash, redactedText),
              redactedText);
      decisionRecorder.recordDecision(
          session, textHash, evaluation.result(), evaluation.rankedCandidates());
      metrics.recordResult(evaluation.result().status());
      return evaluation.result();
    } catch (RuntimeException e) {
      decisionRecorder.recordError(session, textHash, e);
      metrics.recordResult("ERROR");
      return WorkflowMatchResult.unknown(MATCH_FAILURE_MESSAGE);
    } finally {
      metrics.stopMatchTimer(sample);
    }
  }
}
