package com.init.workflowruntime.application;

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
import java.util.List;
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

  public ConsultationMetricsResponse getWorkspaceMetrics(Long workspaceId, Long userId) {
    validateWorkspaceMembership(workspaceId, userId);

    LocalDate today = LocalDate.now(clock.withZone(METRIC_ZONE));
    OffsetDateTime periodStart = today.atStartOfDay(METRIC_ZONE).toOffsetDateTime();
    OffsetDateTime periodEnd = today.plusDays(1).atStartOfDay(METRIC_ZONE).toOffsetDateTime();

    List<ConsultationMetricsSessionFact> facts =
        consultationMetricsRepository.findSessionFacts(workspaceId, periodStart, periodEnd);

    long handledTodayCount =
        facts.stream().filter(ConsultationMetricsSessionFact::handledToday).count();
    long humanHandledTodayCount =
        facts.stream()
            .filter(ConsultationMetricsSessionFact::handledToday)
            .filter(ConsultationMetricsSessionFact::hasHumanMessage)
            .count();
    long llmHandledTodayCount =
        facts.stream()
            .filter(ConsultationMetricsSessionFact::handledToday)
            .filter(fact -> !fact.hasHumanMessage())
            .filter(ConsultationMetricsSessionFact::hasLlmMessage)
            .count();

    return new ConsultationMetricsResponse(
        workspaceId,
        periodStart,
        periodEnd,
        averageSeconds(facts, ResponseKind.ANY),
        averageSeconds(facts, ResponseKind.LLM),
        averageSeconds(facts, ResponseKind.HUMAN),
        handledTodayCount,
        llmHandledTodayCount,
        humanHandledTodayCount);
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
}
