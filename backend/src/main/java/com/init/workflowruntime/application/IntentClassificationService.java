package com.init.workflowruntime.application;

import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.command.IntentClassificationCommand;
import com.init.workflowruntime.application.dto.IntentCandidate;
import com.init.workflowruntime.application.dto.IntentClassificationResult;
import com.init.workflowruntime.application.matching.WorkflowMatchCandidate;
import com.init.workflowruntime.application.matching.WorkflowMatchResult;
import com.init.workflowruntime.application.matching.WorkflowMatchingService;
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

  /**
   * 2위 점수가 1위 점수의 이 비율 이상이면 박빙으로 보고 모호(AMBIGUOUS)로 처리한다. 절대 점수차 대신 비율을 쓰는 이유는, 점수가 토큰 매칭 수에 비례해
   * 스케일이 달라지기 때문이다. (예: 1위 3점 vs 2위 2점은 ratio 0.67 → 우세로 인정)
   */
  private static final double AMBIGUITY_RATIO_THRESHOLD = 0.8;

  private final ChatSessionRepository chatSessionRepository;
  private final IntentDefinitionRepository intentDefinitionRepository;
  private final WorkflowDefinitionRepository workflowDefinitionRepository;
  private final WorkflowMatchingService workflowMatchingService;

  public IntentClassificationService(
      ChatSessionRepository chatSessionRepository,
      IntentDefinitionRepository intentDefinitionRepository,
      WorkflowDefinitionRepository workflowDefinitionRepository,
      WorkflowMatchingService workflowMatchingService) {
    this.chatSessionRepository = chatSessionRepository;
    this.intentDefinitionRepository = intentDefinitionRepository;
    this.workflowDefinitionRepository = workflowDefinitionRepository;
    this.workflowMatchingService = workflowMatchingService;
  }

  @Transactional
  public IntentClassificationResult classify(IntentClassificationCommand command) {
    if (workflowMatchingService.isEnabled()) {
      WorkflowMatchResult matchResult =
          workflowMatchingService.match(
              command.sessionId(), command.latestUserMessage(), command.conversationContext());
      if ("CONFIDENT".equals(matchResult.status())) {
        WorkflowMatchCandidate candidate = matchResult.candidates().getFirst();
        return IntentClassificationResult.confident(
            candidate.intentCode(),
            candidate.workflowCode(),
            candidate.confidence(),
            List.of(toIntentCandidate(candidate)));
      }
      if ("AMBIGUOUS".equals(matchResult.status())) {
        return IntentClassificationResult.ambiguous(
            matchResult.confirmationQuestion(),
            matchResult.candidates().stream().map(this::toIntentCandidate).toList());
      }
      if (!"UNAVAILABLE".equals(matchResult.status())) {
        return IntentClassificationResult.unknown(matchResult.message());
      }
    }

    ChatSession session = findSession(command.sessionId());
    String query =
        normalize(
            nullToEmpty(command.latestUserMessage())
                + "\n"
                + nullToEmpty(command.conversationContext()));

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

    if (second != null
        && second.score() > 0
        && second.score() >= top.score() * AMBIGUITY_RATIO_THRESHOLD) {
      return IntentClassificationResult.ambiguous(
          buildConfirmationQuestion(candidates), candidates);
    }

    return finalizeWorkflowSelection(session, top, query);
  }

  /**
   * 키워드 폴백에서 확신한 intent가 결정된 뒤, 해당 intent의 워크플로우를 선택한다(이슈 #909).
   *
   * <ul>
   *   <li>0개: 기존처럼 intent 수준 CONFIDENT (이후 resolveWorkflow가 처리)
   *   <li>1개: 그 워크플로우로 CONFIDENT
   *   <li>2개 이상: 발화 기준 점수화 후 명확히 우세하면 CONFIDENT, 박빙/무신호면 워크플로우 후보로 AMBIGUOUS(재질의)
   * </ul>
   */
  private IntentClassificationResult finalizeWorkflowSelection(
      ChatSession session, ScoredIntent top, String query) {
    IntentDefinition intent = top.intent();
    List<WorkflowDefinition> workflows =
        workflowDefinitionRepository.findAllByIntentDefinitionIdAndDomainPackVersionId(
            intent.getId(), session.getDomainPackVersionId());

    if (workflows.isEmpty()) {
      return IntentClassificationResult.confident(
          intent.getIntentCode(), confidence(top.score()), List.of(toCandidate(top)));
    }
    if (workflows.size() == 1) {
      return confidentWorkflow(top, workflows.get(0));
    }

    List<ScoredWorkflow> scoredWorkflows =
        workflows.stream()
            .map(workflow -> new ScoredWorkflow(workflow, scoreWorkflow(workflow, query)))
            .sorted(
                Comparator.comparing(ScoredWorkflow::score)
                    .reversed()
                    .thenComparing(
                        scored -> scored.workflow().getIsPrimary(),
                        Comparator.nullsLast(Comparator.reverseOrder()))
                    .thenComparing(
                        scored -> scored.workflow().getId(),
                        Comparator.nullsLast(Comparator.naturalOrder())))
            .toList();

    ScoredWorkflow topWorkflow = scoredWorkflows.get(0);
    ScoredWorkflow secondWorkflow = scoredWorkflows.get(1);
    // 1위 워크플로우가 무신호이거나 2위와 박빙이면 어느 워크플로우인지 단정할 수 없으므로 재질의한다.
    boolean ambiguous =
        topWorkflow.score() <= 0
            || secondWorkflow.score() >= topWorkflow.score() * AMBIGUITY_RATIO_THRESHOLD;
    if (ambiguous) {
      List<IntentCandidate> workflowCandidates =
          scoredWorkflows.stream()
              .limit(2)
              .map(scored -> toWorkflowCandidate(top, scored.workflow()))
              .toList();
      return IntentClassificationResult.ambiguous(
          buildWorkflowConfirmationQuestion(workflowCandidates), workflowCandidates);
    }
    return confidentWorkflow(top, topWorkflow.workflow());
  }

  private IntentClassificationResult confidentWorkflow(
      ScoredIntent top, WorkflowDefinition workflow) {
    return IntentClassificationResult.confident(
        top.intent().getIntentCode(),
        workflow.getWorkflowCode(),
        confidence(top.score()),
        List.of(toWorkflowCandidate(top, workflow)));
  }

  private double scoreWorkflow(WorkflowDefinition workflow, String query) {
    double score = 0.0;
    String name = normalize(workflow.getName());
    if (!name.isBlank() && query.contains(name)) {
      score += 3.0;
    }

    for (String token : tokens(workflow.getWorkflowCode())) {
      if (query.contains(token)) {
        score += 2.0;
      }
    }

    for (String token : tokens(workflow.getName() + " " + workflow.getDescription())) {
      if (query.contains(token)) {
        score += 1.0;
      }
    }

    return score;
  }

  private IntentCandidate toWorkflowCandidate(ScoredIntent top, WorkflowDefinition workflow) {
    return new IntentCandidate(
        top.intent().getIntentCode(),
        top.intent().getName(),
        confidence(top.score()),
        workflow.getWorkflowCode(),
        workflow.getName());
  }

  private String buildWorkflowConfirmationQuestion(List<IntentCandidate> candidates) {
    if (candidates.size() < 2) {
      return "어떤 업무를 도와드리면 될까요?";
    }
    return "%s와 %s 중 어떤 업무에 가까울까요?"
        .formatted(workflowLabel(candidates.get(0)), workflowLabel(candidates.get(1)));
  }

  private String workflowLabel(IntentCandidate candidate) {
    String name = candidate.workflowName();
    return name != null && !name.isBlank() ? name : candidate.name();
  }

  private ScoredIntent score(IntentDefinition intent, String query) {
    double score = 0.0;
    String name = normalize(intent.getName());
    if (!name.isBlank() && query.contains(name)) {
      score += 3.0;
    }

    for (String token : tokens(intent.getIntentCode())) {
      if (query.contains(token)) {
        score += 2.0;
      }
    }

    for (String token : tokens(intent.getName() + " " + intent.getDescription())) {
      if (query.contains(token)) {
        score += 1.0;
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

  private IntentCandidate toIntentCandidate(WorkflowMatchCandidate candidate) {
    return new IntentCandidate(
        candidate.intentCode(),
        candidate.intentName(),
        candidate.confidence(),
        candidate.workflowCode(),
        candidate.workflowName());
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

  private record ScoredWorkflow(WorkflowDefinition workflow, double score) {}
}
