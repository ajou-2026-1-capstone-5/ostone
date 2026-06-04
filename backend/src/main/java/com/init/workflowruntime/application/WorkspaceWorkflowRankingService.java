package com.init.workflowruntime.application;

import com.init.shared.application.exception.BadRequestException;
import com.init.workflowruntime.application.command.GetWorkspaceWorkflowRankingsCommand;
import com.init.workflowruntime.application.dto.WorkspaceWorkflowRankingItemResponse;
import com.init.workflowruntime.application.dto.WorkspaceWorkflowRankingResponse;
import com.init.workflowruntime.domain.WorkflowExecution;
import com.init.workflowruntime.domain.WorkflowRankingExecutionRow;
import com.init.workflowruntime.domain.WorkflowRankingRepository;
import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class WorkspaceWorkflowRankingService {

  private static final ZoneId METRIC_ZONE = ZoneId.of("Asia/Seoul");
  private static final int TOP_RANKING_LIMIT = 5;
  private static final double SURGE_CHANGE_RATE_THRESHOLD = 30.0;
  private static final String WORKSPACE_ACCESS_DENIED_MESSAGE = "워크스페이스에 접근 권한이 없습니다.";

  private final WorkflowRankingRepository workflowRankingRepository;
  private final WorkspaceMemberRepository workspaceMemberRepository;
  private final Clock clock;

  public WorkspaceWorkflowRankingService(
      WorkflowRankingRepository workflowRankingRepository,
      WorkspaceMemberRepository workspaceMemberRepository,
      Clock clock) {
    this.workflowRankingRepository = workflowRankingRepository;
    this.workspaceMemberRepository = workspaceMemberRepository;
    this.clock = clock;
  }

  public WorkspaceWorkflowRankingResponse getRankings(GetWorkspaceWorkflowRankingsCommand command) {
    Long workspaceId = command.workspaceId();
    validateWorkspaceMembership(workspaceId, command.userId());

    RankingPeriod period = resolvePeriod(command);
    long totalConsultationCount =
        workflowRankingRepository.countOperationalConsultations(
            workspaceId, period.start(), period.endExclusive());
    Map<String, WorkflowAggregate> current =
        aggregate(
            workflowRankingRepository.findExecutionRows(
                workspaceId, period.start(), period.endExclusive()));
    Map<String, WorkflowAggregate> previous =
        aggregate(
            workflowRankingRepository.findExecutionRows(
                workspaceId, period.previousStart(), period.start()));

    List<WorkspaceWorkflowRankingItemResponse> unrankedItems =
        current.values().stream()
            .sorted(
                Comparator.comparingLong(WorkflowAggregate::executionCount)
                    .reversed()
                    .thenComparing(WorkflowAggregate::workflowName))
            .map(
                aggregate ->
                    toResponse(
                        workspaceId,
                        aggregate,
                        previous.get(aggregate.groupKey()),
                        totalConsultationCount))
            .toList();

    List<WorkspaceWorkflowRankingItemResponse> rankedItems = assignRanks(unrankedItems);
    return new WorkspaceWorkflowRankingResponse(
        workspaceId,
        period.start(),
        period.endExclusive(),
        totalConsultationCount,
        rankedItems,
        rankedItems.stream().limit(TOP_RANKING_LIMIT).toList());
  }

  private void validateWorkspaceMembership(Long workspaceId, Long userId) {
    workspaceMemberRepository
        .findByWorkspaceIdAndUserId(workspaceId, userId)
        .orElseThrow(() -> new WorkspaceAccessDeniedException(WORKSPACE_ACCESS_DENIED_MESSAGE));
  }

  private RankingPeriod resolvePeriod(GetWorkspaceWorkflowRankingsCommand command) {
    boolean hasFrom = command.fromDate() != null;
    boolean hasTo = command.toDate() != null;
    if (hasFrom != hasTo) {
      throw new BadRequestException(
          "INVALID_WORKFLOW_RANKING_PERIOD", "fromDate and toDate must be provided together");
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
    return new RankingPeriod(start, end, previousStart);
  }

  private Map<String, WorkflowAggregate> aggregate(List<WorkflowRankingExecutionRow> rows) {
    Map<String, WorkflowAggregate> aggregates = new LinkedHashMap<>();
    for (WorkflowRankingExecutionRow row : rows) {
      String groupKey = groupKey(row);
      aggregates
          .computeIfAbsent(groupKey, ignored -> WorkflowAggregate.from(row, groupKey))
          .add(row);
    }
    return aggregates;
  }

  private String groupKey(WorkflowRankingExecutionRow row) {
    if (row.workflowDefinitionId() != null) {
      return "workflow:" + row.workflowDefinitionId();
    }
    if (row.workflowCode() != null && !row.workflowCode().isBlank()) {
      return "code:" + row.workflowCode();
    }
    return "unknown";
  }

  private WorkspaceWorkflowRankingItemResponse toResponse(
      Long workspaceId,
      WorkflowAggregate aggregate,
      WorkflowAggregate previous,
      long totalConsultationCount) {
    Double changeRate =
        previous == null ? null : changeRate(aggregate.executionCount(), previous.executionCount());
    return new WorkspaceWorkflowRankingItemResponse(
        0,
        aggregate.workflowDefinitionId(),
        aggregate.domainPackId(),
        aggregate.domainPackVersionId(),
        aggregate.workflowCode(),
        aggregate.workflowName(),
        aggregate.executionCount(),
        percentage(aggregate.executionCount(), totalConsultationCount),
        aggregate.completedCount(),
        aggregate.failedCount(),
        aggregate.runningCount(),
        percentage(aggregate.completedCount(), aggregate.executionCount()),
        percentage(aggregate.failedCount(), aggregate.executionCount()),
        aggregate.averageHandlingSeconds(),
        percentage(aggregate.humanInterventionCount(), aggregate.executionCount()),
        changeRate,
        changeRate != null && changeRate >= SURGE_CHANGE_RATE_THRESHOLD,
        detailPath(workspaceId, aggregate));
  }

  private List<WorkspaceWorkflowRankingItemResponse> assignRanks(
      List<WorkspaceWorkflowRankingItemResponse> items) {
    List<WorkspaceWorkflowRankingItemResponse> ranked = new ArrayList<>();
    for (int index = 0; index < items.size(); index++) {
      WorkspaceWorkflowRankingItemResponse item = items.get(index);
      ranked.add(
          new WorkspaceWorkflowRankingItemResponse(
              index + 1,
              item.workflowDefinitionId(),
              item.domainPackId(),
              item.domainPackVersionId(),
              item.workflowCode(),
              item.workflowName(),
              item.executionCount(),
              item.shareRate(),
              item.completedCount(),
              item.failedCount(),
              item.runningCount(),
              item.completionRate(),
              item.failureRate(),
              item.averageHandlingSeconds(),
              item.humanInterventionRate(),
              item.changeRate(),
              item.surging(),
              item.detailPath()));
    }
    return ranked;
  }

  private String detailPath(Long workspaceId, WorkflowAggregate aggregate) {
    if (aggregate.domainPackId() == null
        || aggregate.domainPackVersionId() == null
        || aggregate.workflowDefinitionId() == null) {
      return null;
    }
    return "/workspaces/%d/domain-packs/%d/workflows/%d?versionId=%d"
        .formatted(
            workspaceId,
            aggregate.domainPackId(),
            aggregate.workflowDefinitionId(),
            aggregate.domainPackVersionId());
  }

  private double percentage(long numerator, long denominator) {
    if (denominator <= 0) {
      return 0.0;
    }
    return roundOneDecimal((numerator * 100.0) / denominator);
  }

  private Double changeRate(long current, long previous) {
    if (previous == 0) {
      return null;
    }
    return roundOneDecimal(((current - previous) * 100.0) / previous);
  }

  private double roundOneDecimal(double value) {
    return Math.round(value * 10.0) / 10.0;
  }

  private record RankingPeriod(
      OffsetDateTime start, OffsetDateTime endExclusive, OffsetDateTime previousStart) {}

  private static final class WorkflowAggregate {
    private final String groupKey;
    private final Long workflowDefinitionId;
    private final Long domainPackId;
    private final Long domainPackVersionId;
    private final String workflowCode;
    private final String workflowName;
    private long executionCount;
    private long completedCount;
    private long failedCount;
    private long humanInterventionCount;
    private long handlingSecondsSum;
    private long handlingSecondsCount;

    private WorkflowAggregate(
        String groupKey,
        Long workflowDefinitionId,
        Long domainPackId,
        Long domainPackVersionId,
        String workflowCode,
        String workflowName) {
      this.groupKey = groupKey;
      this.workflowDefinitionId = workflowDefinitionId;
      this.domainPackId = domainPackId;
      this.domainPackVersionId = domainPackVersionId;
      this.workflowCode = workflowCode;
      this.workflowName = workflowName;
    }

    static WorkflowAggregate from(WorkflowRankingExecutionRow row, String groupKey) {
      String fallbackName =
          row.workflowDefinitionId() == null ? "미확인 워크플로우" : "워크플로우 #" + row.workflowDefinitionId();
      return new WorkflowAggregate(
          groupKey,
          row.workflowDefinitionId(),
          row.domainPackId(),
          row.domainPackVersionId(),
          row.workflowCode(),
          nonBlank(row.workflowName(), fallbackName));
    }

    void add(WorkflowRankingExecutionRow row) {
      executionCount++;
      if (WorkflowExecution.STATUS_COMPLETED.equals(row.status())) {
        completedCount++;
      } else if (WorkflowExecution.STATUS_FAILED.equals(row.status())) {
        failedCount++;
      }
      if (row.hasHumanMessage()) {
        humanInterventionCount++;
      }
      Long seconds = handlingSeconds(row.startedAt(), row.finishedAt());
      if (seconds != null) {
        handlingSecondsSum += seconds;
        handlingSecondsCount++;
      }
    }

    private Long handlingSeconds(OffsetDateTime startedAt, OffsetDateTime finishedAt) {
      if (startedAt == null || finishedAt == null || finishedAt.isBefore(startedAt)) {
        return null;
      }
      return Duration.between(startedAt, finishedAt).getSeconds();
    }

    private static String nonBlank(String value, String fallback) {
      return value == null || value.isBlank() ? fallback : value;
    }

    String groupKey() {
      return groupKey;
    }

    Long workflowDefinitionId() {
      return workflowDefinitionId;
    }

    Long domainPackId() {
      return domainPackId;
    }

    Long domainPackVersionId() {
      return domainPackVersionId;
    }

    String workflowCode() {
      return workflowCode;
    }

    String workflowName() {
      return workflowName;
    }

    long executionCount() {
      return executionCount;
    }

    long completedCount() {
      return completedCount;
    }

    long failedCount() {
      return failedCount;
    }

    long runningCount() {
      return executionCount - completedCount - failedCount;
    }

    long humanInterventionCount() {
      return humanInterventionCount;
    }

    Long averageHandlingSeconds() {
      if (handlingSecondsCount == 0) {
        return null;
      }
      return Math.round((double) handlingSecondsSum / handlingSecondsCount);
    }
  }
}
