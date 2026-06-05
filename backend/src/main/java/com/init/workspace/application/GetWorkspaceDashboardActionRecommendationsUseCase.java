package com.init.workspace.application;

import com.init.shared.application.exception.BadRequestException;
import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.application.exception.WorkspaceNotFoundException;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import com.init.workspace.domain.repository.WorkspaceRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GetWorkspaceDashboardActionRecommendationsUseCase {

  private static final ZoneId METRIC_ZONE = ZoneId.of("Asia/Seoul");
  private static final int MAX_RECOMMENDATIONS = 3;
  private static final int STALE_KNOWLEDGE_PACK_DAYS = 30;
  private static final int REPEATED_FEEDBACK_TYPE_THRESHOLD = 3;
  private static final double RISK_SURGE_THRESHOLD = 30.0;
  private static final double MISSING_SLOT_RATE_THRESHOLD = 20.0;
  private static final double LOW_CONFIDENCE_RATE_THRESHOLD = 10.0;
  private static final String OPERATIONAL_SOURCE_LABEL = "운영 지표 기반";
  private static final String SIMULATION_SOURCE_LABEL = "시뮬레이션에서 발견됨";

  private final WorkspaceRepository workspaceRepository;
  private final WorkspaceMemberRepository workspaceMemberRepository;
  private final WorkspaceDashboardQueryPort workspaceDashboardQueryPort;
  private final Clock clock;

  public GetWorkspaceDashboardActionRecommendationsUseCase(
      WorkspaceRepository workspaceRepository,
      WorkspaceMemberRepository workspaceMemberRepository,
      WorkspaceDashboardQueryPort workspaceDashboardQueryPort,
      Clock clock) {
    this.workspaceRepository = workspaceRepository;
    this.workspaceMemberRepository = workspaceMemberRepository;
    this.workspaceDashboardQueryPort = workspaceDashboardQueryPort;
    this.clock = clock;
  }

  public WorkspaceDashboardActionRecommendationsResult execute(
      GetWorkspaceDashboardActionRecommendationsCommand command) {
    Long workspaceId = command.workspaceId();
    validateWorkspaceAccess(workspaceId, command.userId());

    RecommendationPeriod period = resolvePeriod(command);
    WorkspaceDashboardRecommendationSignalsResult signals =
        workspaceDashboardQueryPort.findRecommendationSignals(
            workspaceId, period.start(), period.endExclusive(), period.previousStart());

    List<WorkspaceDashboardActionRecommendationResult> recommendations = new ArrayList<>();
    addOpenSimulationFeedbackRecommendation(workspaceId, signals, recommendations);
    addSimulationReviewCandidateRecommendation(workspaceId, signals, recommendations);
    addFailedGoldenCaseRecommendation(workspaceId, signals, recommendations);
    addRepeatedSimulationFeedbackRecommendation(workspaceId, signals, recommendations);
    addPipelineFailedRecommendation(workspaceId, signals, recommendations);
    addRiskHitSurgeRecommendation(workspaceId, signals, recommendations);
    addHotpathSurgeRecommendation(workspaceId, signals, recommendations);
    addLowCompletionRecommendation(workspaceId, signals, recommendations);
    addMissingSlotRecommendation(workspaceId, signals, recommendations);
    addLowConfidenceRecommendation(workspaceId, signals, recommendations);
    addStaleKnowledgePackRecommendation(workspaceId, signals, recommendations);

    List<WorkspaceDashboardActionRecommendationResult> topRecommendations =
        recommendations.stream()
            .sorted(
                Comparator.comparingInt(WorkspaceDashboardActionRecommendationResult::priority)
                    .reversed()
                    .thenComparing(WorkspaceDashboardActionRecommendationResult::ruleCode))
            .limit(MAX_RECOMMENDATIONS)
            .toList();

    return new WorkspaceDashboardActionRecommendationsResult(
        workspaceId, signals.periodStart(), signals.periodEnd(), topRecommendations);
  }

  private void validateWorkspaceAccess(Long workspaceId, Long userId) {
    if (!workspaceRepository.existsById(workspaceId)) {
      throw new WorkspaceNotFoundException("워크스페이스를 찾을 수 없습니다.");
    }
    workspaceMemberRepository
        .findByWorkspaceIdAndUserId(workspaceId, userId)
        .orElseThrow(() -> new WorkspaceAccessDeniedException("워크스페이스에 접근 권한이 없습니다."));
  }

  private RecommendationPeriod resolvePeriod(
      GetWorkspaceDashboardActionRecommendationsCommand command) {
    boolean hasFrom = command.fromDate() != null;
    boolean hasTo = command.toDate() != null;
    if (hasFrom != hasTo) {
      throw new BadRequestException(
          "INVALID_DASHBOARD_RECOMMENDATION_PERIOD",
          "fromDate and toDate must be provided together");
    }

    LocalDate startDate;
    LocalDate endDateExclusive;
    if (hasFrom) {
      startDate = command.fromDate();
      endDateExclusive = command.toDate().plusDays(1);
    } else {
      LocalDate today = LocalDate.now(clock.withZone(METRIC_ZONE));
      startDate = today;
      endDateExclusive = today.plusDays(1);
    }

    long days = ChronoUnit.DAYS.between(startDate, endDateExclusive);
    OffsetDateTime start = startDate.atStartOfDay(METRIC_ZONE).toOffsetDateTime();
    OffsetDateTime end = endDateExclusive.atStartOfDay(METRIC_ZONE).toOffsetDateTime();
    OffsetDateTime previousStart =
        startDate.minusDays(days).atStartOfDay(METRIC_ZONE).toOffsetDateTime();
    return new RecommendationPeriod(start, end, previousStart);
  }

  private void addOpenSimulationFeedbackRecommendation(
      Long workspaceId,
      WorkspaceDashboardRecommendationSignalsResult signals,
      List<WorkspaceDashboardActionRecommendationResult> recommendations) {
    WorkspaceDashboardSimulationSignalResult simulation = simulationSignals(signals);
    if (simulation.openFeedbackCount() <= 0) {
      return;
    }

    recommendations.add(
        new WorkspaceDashboardActionRecommendationResult(
            "SIMULATION_OPEN_FEEDBACK",
            95,
            SIMULATION_SOURCE_LABEL,
            "개선 후보 생성",
            "미처리 시뮬레이션 피드백이 있어 지식팩 개선 후보로 정리할 수 있습니다.",
            "Open feedback",
            formatCount(simulation.openFeedbackCount()),
            "/workspaces/%d/simulation?feedbackStatus=OPEN".formatted(workspaceId)));
  }

  private void addSimulationReviewCandidateRecommendation(
      Long workspaceId,
      WorkspaceDashboardRecommendationSignalsResult signals,
      List<WorkspaceDashboardActionRecommendationResult> recommendations) {
    WorkspaceDashboardSimulationSignalResult simulation = simulationSignals(signals);
    if (simulation.readyForReviewCandidateCount() <= 0) {
      return;
    }

    recommendations.add(
        new WorkspaceDashboardActionRecommendationResult(
            "SIMULATION_REVIEW_PENDING_CANDIDATE",
            92,
            SIMULATION_SOURCE_LABEL,
            "개선 후보 검토 진행",
            "시뮬레이션에서 만든 개선 후보가 review 대기 중입니다.",
            "Review 대기 후보",
            formatCount(simulation.readyForReviewCandidateCount()),
            "/workspaces/%d/simulation?candidateStatus=READY_FOR_REVIEW".formatted(workspaceId)));
  }

  private void addFailedGoldenCaseRecommendation(
      Long workspaceId,
      WorkspaceDashboardRecommendationSignalsResult signals,
      List<WorkspaceDashboardActionRecommendationResult> recommendations) {
    WorkspaceDashboardSimulationSignalResult simulation = simulationSignals(signals);
    if (simulation.failedGoldenCaseCount() <= 0) {
      return;
    }

    recommendations.add(
        new WorkspaceDashboardActionRecommendationResult(
            "SIMULATION_GOLDEN_CASE_FAILED",
            88,
            SIMULATION_SOURCE_LABEL,
            "변경 영향 확인",
            "최근 replay에서 실패한 검증 케이스가 있어 변경 영향을 확인해야 합니다.",
            "실패 검증 케이스",
            formatCount(simulation.failedGoldenCaseCount()),
            "/workspaces/%d/simulation?focus=golden-cases".formatted(workspaceId)));
  }

  private void addRepeatedSimulationFeedbackRecommendation(
      Long workspaceId,
      WorkspaceDashboardRecommendationSignalsResult signals,
      List<WorkspaceDashboardActionRecommendationResult> recommendations) {
    WorkspaceDashboardSimulationSignalResult simulation = simulationSignals(signals);
    if (simulation.topOpenFeedbackTypeCount() < REPEATED_FEEDBACK_TYPE_THRESHOLD
        || simulation.topOpenFeedbackType() == null) {
      return;
    }

    recommendations.add(
        new WorkspaceDashboardActionRecommendationResult(
            "SIMULATION_REPEATED_FEEDBACK_TYPE",
            82,
            SIMULATION_SOURCE_LABEL,
            "workflow/slot/policy 집중 점검",
            "동일 유형의 시뮬레이션 피드백이 반복되어 관련 정의를 함께 점검해야 합니다.",
            formatFeedbackType(simulation.topOpenFeedbackType()),
            formatCount(simulation.topOpenFeedbackTypeCount()),
            "/workspaces/%d/simulation?feedbackStatus=OPEN".formatted(workspaceId)));
  }

  private void addPipelineFailedRecommendation(
      Long workspaceId,
      WorkspaceDashboardRecommendationSignalsResult signals,
      List<WorkspaceDashboardActionRecommendationResult> recommendations) {
    WorkspaceDashboardGenerationResult generation = signals.health().lastKnowledgePackGeneration();
    if (generation == null || !"FAILED".equalsIgnoreCase(generation.status())) {
      return;
    }

    recommendations.add(
        new WorkspaceDashboardActionRecommendationResult(
            "PIPELINE_FAILED",
            100,
            OPERATIONAL_SOURCE_LABEL,
            "생성 실패 확인",
            "최근 지식팩 생성이 실패했습니다. 실패 사유를 확인하고 다시 실행하세요.",
            "Pipeline job",
            "#" + generation.pipelineJobId() + " FAILED",
            "/workspaces/%d/upload?jobId=%d".formatted(workspaceId, generation.pipelineJobId())));
  }

  private void addRiskHitSurgeRecommendation(
      Long workspaceId,
      WorkspaceDashboardRecommendationSignalsResult signals,
      List<WorkspaceDashboardActionRecommendationResult> recommendations) {
    long current = signals.currentDecisionSignals().riskHitCount();
    long previous = signals.previousDecisionSignals().riskHitCount();
    Double changeRate = changeRate(current, previous);
    if (changeRate == null || changeRate < RISK_SURGE_THRESHOLD) {
      return;
    }

    recommendations.add(
        new WorkspaceDashboardActionRecommendationResult(
            "RISK_HIT_SURGE",
            90,
            OPERATIONAL_SOURCE_LABEL,
            "주의 사항 검토",
            "선택 기간 risk hit가 전 기간보다 크게 증가했습니다.",
            "Risk hit",
            "%s (%s)".formatted(formatCount(current), formatSignedPercent(changeRate)),
            "/workspaces/%d/domain-packs".formatted(workspaceId)));
  }

  private void addHotpathSurgeRecommendation(
      Long workspaceId,
      WorkspaceDashboardRecommendationSignalsResult signals,
      List<WorkspaceDashboardActionRecommendationResult> recommendations) {
    WorkspaceDashboardWorkflowRecommendationSignal workflow = signals.hotpathSurgeWorkflow();
    if (workflow == null || workflow.changeRate() == null) {
      return;
    }

    recommendations.add(
        new WorkspaceDashboardActionRecommendationResult(
            "HOTPATH_SURGE",
            85,
            OPERATIONAL_SOURCE_LABEL,
            workflow.workflowName() + " workflow 점검",
            "선택 기간 실행량이 전 기간보다 크게 증가했습니다.",
            "전 기간 대비",
            formatSignedPercent(workflow.changeRate()),
            workflowPath(workspaceId, workflow)));
  }

  private void addLowCompletionRecommendation(
      Long workspaceId,
      WorkspaceDashboardRecommendationSignalsResult signals,
      List<WorkspaceDashboardActionRecommendationResult> recommendations) {
    WorkspaceDashboardWorkflowRecommendationSignal workflow = signals.lowCompletionWorkflow();
    if (workflow == null || workflow.completionRate() == null) {
      return;
    }

    recommendations.add(
        new WorkspaceDashboardActionRecommendationResult(
            "LOW_COMPLETION_RATE",
            80,
            OPERATIONAL_SOURCE_LABEL,
            "병목 state 확인",
            workflow.workflowName() + " workflow 완료율이 낮습니다.",
            "완료율",
            formatPercent(workflow.completionRate()),
            workflowPath(workspaceId, workflow)));
  }

  private void addMissingSlotRecommendation(
      Long workspaceId,
      WorkspaceDashboardRecommendationSignalsResult signals,
      List<WorkspaceDashboardActionRecommendationResult> recommendations) {
    WorkspaceDashboardDecisionSignalResult current = signals.currentDecisionSignals();
    Double rate = rate(current.missingSlotHitCount(), current.decisionLogCount());
    if (rate == null || rate < MISSING_SLOT_RATE_THRESHOLD) {
      return;
    }

    recommendations.add(
        new WorkspaceDashboardActionRecommendationResult(
            "MISSING_SLOT_HIGH",
            75,
            OPERATIONAL_SOURCE_LABEL,
            "확인 항목 수정",
            "상담 중 필요한 slot을 채우지 못한 결정 로그 비율이 높습니다.",
            "Missing slot",
            "%s (%s)".formatted(formatCount(current.missingSlotHitCount()), formatPercent(rate)),
            "/workspaces/%d/domain-packs".formatted(workspaceId)));
  }

  private void addLowConfidenceRecommendation(
      Long workspaceId,
      WorkspaceDashboardRecommendationSignalsResult signals,
      List<WorkspaceDashboardActionRecommendationResult> recommendations) {
    WorkspaceDashboardDecisionSignalResult current = signals.currentDecisionSignals();
    Double rate = rate(current.lowConfidenceCount(), current.decisionLogCount());
    if (rate == null || rate < LOW_CONFIDENCE_RATE_THRESHOLD) {
      return;
    }

    recommendations.add(
        new WorkspaceDashboardActionRecommendationResult(
            "LOW_CONFIDENCE_HIGH",
            70,
            OPERATIONAL_SOURCE_LABEL,
            "상담 로그 추가 업로드",
            "저신뢰 decision 비율이 높아 최근 상담 로그 보강이 필요합니다.",
            "Low confidence",
            "%s (%s)".formatted(formatCount(current.lowConfidenceCount()), formatPercent(rate)),
            "/workspaces/%d/upload".formatted(workspaceId)));
  }

  private void addStaleKnowledgePackRecommendation(
      Long workspaceId,
      WorkspaceDashboardRecommendationSignalsResult signals,
      List<WorkspaceDashboardActionRecommendationResult> recommendations) {
    WorkspaceDashboardKnowledgePackResult knowledgePack = signals.health().activeKnowledgePack();
    if (knowledgePack == null || knowledgePack.publishedAt() == null) {
      return;
    }

    LocalDate publishedDate =
        knowledgePack.publishedAt().atZoneSameInstant(METRIC_ZONE).toLocalDate();
    LocalDate today = LocalDate.now(clock.withZone(METRIC_ZONE));
    long ageDays = ChronoUnit.DAYS.between(publishedDate, today);
    if (ageDays < STALE_KNOWLEDGE_PACK_DAYS) {
      return;
    }

    recommendations.add(
        new WorkspaceDashboardActionRecommendationResult(
            "STALE_KNOWLEDGE_PACK",
            60,
            OPERATIONAL_SOURCE_LABEL,
            "새 로그로 지식팩 업데이트",
            "운영 중인 지식팩이 오래되어 최근 상담 패턴 반영이 필요할 수 있습니다.",
            "Published",
            ageDays + "일 전",
            "/workspaces/%d/upload".formatted(workspaceId)));
  }

  private String workflowPath(
      Long workspaceId, WorkspaceDashboardWorkflowRecommendationSignal workflow) {
    if (workflow.domainPackId() == null
        || workflow.domainPackVersionId() == null
        || workflow.workflowDefinitionId() == null) {
      return "/workspaces/%d/workflows".formatted(workspaceId);
    }
    return "/workspaces/%d/domain-packs/%d/workflows/%d?versionId=%d"
        .formatted(
            workspaceId,
            workflow.domainPackId(),
            workflow.workflowDefinitionId(),
            workflow.domainPackVersionId());
  }

  private WorkspaceDashboardSimulationSignalResult simulationSignals(
      WorkspaceDashboardRecommendationSignalsResult signals) {
    WorkspaceDashboardSimulationSignalResult simulation = signals.simulationSignals();
    if (simulation != null) {
      return simulation;
    }
    return new WorkspaceDashboardSimulationSignalResult(0, 0, 0, null, 0);
  }

  private String formatFeedbackType(String feedbackType) {
    return switch (feedbackType) {
      case "INTENT_MISMATCH" -> "Intent mismatch";
      case "MISSING_SLOT_QUESTION" -> "Missing slot";
      case "INAPPROPRIATE_RESPONSE" -> "응답 문구";
      case "POLICY_CONDITION_MISSING" -> "Policy 조건";
      case "RISK_HANDOFF_REQUIRED" -> "Risk/handoff";
      case "WORKFLOW_BRANCH_ERROR" -> "Workflow 분기";
      case "OTHER" -> "기타 feedback";
      default -> feedbackType;
    };
  }

  private Double changeRate(long current, long previous) {
    if (previous <= 0) {
      return null;
    }
    return roundOneDecimal(((current - previous) * 100.0) / previous);
  }

  private Double rate(long numerator, long denominator) {
    if (denominator <= 0) {
      return null;
    }
    return roundOneDecimal((numerator * 100.0) / denominator);
  }

  private double roundOneDecimal(double value) {
    return Math.round(value * 10.0) / 10.0;
  }

  private String formatCount(long value) {
    return String.format("%,d건", value);
  }

  private String formatPercent(double value) {
    return "%.1f%%".formatted(value);
  }

  private String formatSignedPercent(double value) {
    return "%s%.1f%%".formatted(value > 0 ? "+" : "", value);
  }

  private record RecommendationPeriod(
      OffsetDateTime start, OffsetDateTime endExclusive, OffsetDateTime previousStart) {}
}
