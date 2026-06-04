package com.init.workflowruntime.application;

import com.init.workflowruntime.application.command.GetWorkspaceMetricsCommand;
import com.init.workflowruntime.application.dto.ConsultationCoverageMetricsResponse;
import com.init.workflowruntime.application.dto.ConsultationCoverageTrendPointResponse;
import com.init.workflowruntime.application.dto.ConsultationMetricsComparisonResponse;
import com.init.workflowruntime.application.dto.ConsultationMetricsResponse;
import com.init.workflowruntime.domain.ConsultationMetricsRepository;
import com.init.workflowruntime.domain.ConsultationMetricsSessionFact;
import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ConsultationMetricsService {

  private static final ZoneId METRIC_ZONE = ZoneId.of("Asia/Seoul");

  private final ConsultationMetricsRepository consultationMetricsRepository;
  private final WorkspaceMemberRepository workspaceMemberRepository;
  private final Clock clock;

  public ConsultationMetricsService(
      ConsultationMetricsRepository consultationMetricsRepository,
      WorkspaceMemberRepository workspaceMemberRepository,
      Clock clock) {
    this.consultationMetricsRepository = consultationMetricsRepository;
    this.workspaceMemberRepository = workspaceMemberRepository;
    this.clock = clock;
  }

  public ConsultationMetricsResponse getWorkspaceMetrics(GetWorkspaceMetricsCommand command) {
    Long workspaceId = command.workspaceId();
    Long userId = command.userId();
    validateWorkspaceMembership(workspaceId, userId);

    MetricPeriod period = resolvePeriod(command);

    List<ConsultationMetricsSessionFact> facts =
        consultationMetricsRepository.findSessionFacts(
            workspaceId, period.start(), period.endExclusive());
    MetricSnapshot current = snapshot(facts);

    List<ConsultationMetricsSessionFact> previousFacts =
        consultationMetricsRepository.findSessionFacts(
            workspaceId, period.previousStart(), period.start());
    MetricSnapshot previous = snapshot(previousFacts);

    return new ConsultationMetricsResponse(
        workspaceId,
        period.start(),
        period.endExclusive(),
        current.totalConsultationCount(),
        current.completedConsultationCount(),
        current.averageFirstResponseSeconds(),
        current.averageLlmFirstResponseSeconds(),
        current.averageHumanFirstResponseSeconds(),
        current.llmHandledCount(),
        current.humanInterventionCount(),
        current.unresolvedSessionCount(),
        comparison(current, previous),
        coverage(facts, period),
        current.completedConsultationCount(),
        current.llmHandledCount(),
        current.humanInterventionCount());
  }

  private void validateWorkspaceMembership(Long workspaceId, Long userId) {
    workspaceMemberRepository
        .findByWorkspaceIdAndUserId(workspaceId, userId)
        .orElseThrow(() -> new WorkspaceAccessDeniedException("워크스페이스에 접근 권한이 없습니다."));
  }

  private Long averageSeconds(List<ConsultationMetricsSessionFact> facts, ResponseKind kind) {
    double average =
        facts.stream()
            .map(fact -> responseSeconds(fact, kind))
            .filter(Objects::nonNull)
            .mapToLong(Long::longValue)
            .average()
            .orElse(Double.NaN);
    return Double.isNaN(average) ? null : Math.round(average);
  }

  private Long responseSeconds(ConsultationMetricsSessionFact fact, ResponseKind kind) {
    OffsetDateTime firstCustomerAt = fact.firstCustomerAt();
    OffsetDateTime responseAt =
        switch (kind) {
          case ANY -> fact.firstResponseAt();
          case LLM -> fact.firstLlmResponseAt();
          case HUMAN -> fact.firstHumanResponseAt();
        };

    if (firstCustomerAt == null || responseAt == null || responseAt.isBefore(firstCustomerAt)) {
      return null;
    }
    return Duration.between(firstCustomerAt, responseAt).getSeconds();
  }

  private enum ResponseKind {
    ANY,
    LLM,
    HUMAN
  }

  private MetricPeriod resolvePeriod(GetWorkspaceMetricsCommand command) {
    LocalDate startDate;
    LocalDate endDateExclusive;
    if (command.fromDate() != null) {
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
    return new MetricPeriod(start, end, previousStart);
  }

  private MetricSnapshot snapshot(List<ConsultationMetricsSessionFact> facts) {
    long completedCount =
        facts.stream().filter(ConsultationMetricsSessionFact::handledInPeriod).count();
    long humanInterventionCount =
        facts.stream()
            .filter(ConsultationMetricsSessionFact::handledInPeriod)
            .filter(ConsultationMetricsSessionFact::hasHumanMessage)
            .count();
    long llmHandledCount =
        facts.stream()
            .filter(ConsultationMetricsSessionFact::handledInPeriod)
            .filter(fact -> !fact.hasHumanMessage())
            .filter(ConsultationMetricsSessionFact::hasLlmMessage)
            .count();

    return new MetricSnapshot(
        facts.stream().filter(ConsultationMetricsSessionFact::startedInPeriod).count(),
        completedCount,
        averageSeconds(facts, ResponseKind.ANY),
        averageSeconds(facts, ResponseKind.LLM),
        averageSeconds(facts, ResponseKind.HUMAN),
        llmHandledCount,
        humanInterventionCount,
        facts.stream().filter(ConsultationMetricsSessionFact::unresolvedInPeriod).count());
  }

  private ConsultationMetricsComparisonResponse comparison(
      MetricSnapshot current, MetricSnapshot previous) {
    return new ConsultationMetricsComparisonResponse(
        changeRate(current.totalConsultationCount(), previous.totalConsultationCount()),
        changeRate(current.completedConsultationCount(), previous.completedConsultationCount()),
        changeRate(current.averageFirstResponseSeconds(), previous.averageFirstResponseSeconds()),
        changeRate(
            current.averageLlmFirstResponseSeconds(), previous.averageLlmFirstResponseSeconds()),
        changeRate(
            current.averageHumanFirstResponseSeconds(),
            previous.averageHumanFirstResponseSeconds()),
        changeRate(current.llmHandledCount(), previous.llmHandledCount()),
        changeRate(current.humanInterventionCount(), previous.humanInterventionCount()),
        changeRate(current.unresolvedSessionCount(), previous.unresolvedSessionCount()));
  }

  private Double changeRate(Number current, Number previous) {
    if (current == null || previous == null || previous.doubleValue() == 0) {
      return null;
    }
    double rate = ((current.doubleValue() - previous.doubleValue()) / previous.doubleValue()) * 100;
    return Math.round(rate * 10.0) / 10.0;
  }

  private ConsultationCoverageMetricsResponse coverage(
      List<ConsultationMetricsSessionFact> facts, MetricPeriod period) {
    List<ConsultationMetricsSessionFact> startedFacts =
        facts.stream().filter(ConsultationMetricsSessionFact::startedInPeriod).toList();
    long totalCount = startedFacts.size();
    long workflowMatchedCount =
        startedFacts.stream().filter(ConsultationMetricsSessionFact::workflowMatched).count();
    long intentClassifiedCount =
        startedFacts.stream().filter(ConsultationMetricsSessionFact::intentClassified).count();
    long lowConfidenceCount =
        startedFacts.stream().filter(ConsultationMetricsSessionFact::lowConfidence).count();
    long unmatchedSessionCount =
        startedFacts.stream().filter(ConsultationMetricsSessionFact::unmatched).count();
    long startedCompletedCount =
        startedFacts.stream().filter(ConsultationMetricsSessionFact::handledInPeriod).count();
    long startedHumanInterventionCount =
        startedFacts.stream()
            .filter(fact -> fact.hasHumanMessage() || fact.handoffSelected())
            .count();
    long startedLlmOnlyCompletedCount =
        startedFacts.stream()
            .filter(ConsultationMetricsSessionFact::handledInPeriod)
            .filter(fact -> !fact.hasHumanMessage())
            .filter(ConsultationMetricsSessionFact::hasLlmMessage)
            .count();
    long autoCompletedWorkflowCount =
        startedFacts.stream()
            .filter(ConsultationMetricsSessionFact::workflowMatched)
            .filter(ConsultationMetricsSessionFact::handledInPeriod)
            .filter(fact -> !fact.hasHumanMessage())
            .filter(ConsultationMetricsSessionFact::hasLlmMessage)
            .count();
    boolean hasCoverageLogs =
        startedFacts.stream().anyMatch(ConsultationMetricsSessionFact::coverageLogAvailable);
    String measurementStatus =
        totalCount > 0 && !hasCoverageLogs ? "NEEDS_INSTRUMENTATION" : "READY";
    String measurementMessage =
        "NEEDS_INSTRUMENTATION".equals(measurementStatus)
            ? "커버리지 산출에 필요한 decision log 또는 workflow match log 계측이 필요합니다."
            : "커버리지 산출에 필요한 운영 로그가 확인되었습니다.";

    return new ConsultationCoverageMetricsResponse(
        workflowMatchedCount,
        rate(workflowMatchedCount, totalCount),
        intentClassifiedCount,
        rate(intentClassifiedCount, totalCount),
        lowConfidenceCount,
        rate(lowConfidenceCount, totalCount),
        unmatchedSessionCount,
        autoCompletedWorkflowCount,
        rate(startedHumanInterventionCount, totalCount),
        rate(startedLlmOnlyCompletedCount, startedCompletedCount),
        measurementStatus,
        measurementMessage,
        coverageTrend(startedFacts, period));
  }

  private List<ConsultationCoverageTrendPointResponse> coverageTrend(
      List<ConsultationMetricsSessionFact> startedFacts, MetricPeriod period) {
    Map<LocalDate, List<ConsultationMetricsSessionFact>> factsByDate = new LinkedHashMap<>();
    LocalDate startDate = period.start().atZoneSameInstant(METRIC_ZONE).toLocalDate();
    LocalDate endDateExclusive = period.endExclusive().atZoneSameInstant(METRIC_ZONE).toLocalDate();
    for (LocalDate date = startDate; date.isBefore(endDateExclusive); date = date.plusDays(1)) {
      factsByDate.put(date, new ArrayList<>());
    }

    for (ConsultationMetricsSessionFact fact : startedFacts) {
      if (fact.startedAt() == null) {
        continue;
      }
      LocalDate date = fact.startedAt().atZoneSameInstant(METRIC_ZONE).toLocalDate();
      List<ConsultationMetricsSessionFact> dailyFacts = factsByDate.get(date);
      if (dailyFacts != null) {
        dailyFacts.add(fact);
      }
    }

    return factsByDate.entrySet().stream()
        .map(
            entry -> {
              long totalCount = entry.getValue().size();
              long matchedCount =
                  entry.getValue().stream()
                      .filter(ConsultationMetricsSessionFact::workflowMatched)
                      .count();
              return new ConsultationCoverageTrendPointResponse(
                  entry.getKey(), totalCount, matchedCount, rate(matchedCount, totalCount));
            })
        .toList();
  }

  private Double rate(long numerator, long denominator) {
    if (denominator == 0) {
      return null;
    }
    return Math.round(((double) numerator / denominator) * 1000.0) / 10.0;
  }

  private record MetricPeriod(
      OffsetDateTime start, OffsetDateTime endExclusive, OffsetDateTime previousStart) {}

  private record MetricSnapshot(
      long totalConsultationCount,
      long completedConsultationCount,
      Long averageFirstResponseSeconds,
      Long averageLlmFirstResponseSeconds,
      Long averageHumanFirstResponseSeconds,
      long llmHandledCount,
      long humanInterventionCount,
      long unresolvedSessionCount) {}
}
