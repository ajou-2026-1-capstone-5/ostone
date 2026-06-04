package com.init.workflowruntime.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.shared.application.exception.BadRequestException;
import com.init.workflowruntime.application.command.GetWorkflowBottleneckAnalysisCommand;
import com.init.workflowruntime.application.dto.WorkflowHitMetricResponse;
import com.init.workflowruntime.application.dto.WorkflowHumanInterventionMetricResponse;
import com.init.workflowruntime.application.dto.WorkflowStateBottleneckResponse;
import com.init.workflowruntime.application.dto.WorkflowTransitionMetricResponse;
import com.init.workflowruntime.application.dto.WorkspaceWorkflowBottleneckAnalysisResponse;
import com.init.workflowruntime.domain.WorkflowBottleneckAnalysisRepository;
import com.init.workflowruntime.domain.WorkflowBottleneckDecisionRow;
import com.init.workflowruntime.domain.WorkflowBottleneckExecutionRow;
import com.init.workflowruntime.domain.WorkflowBottleneckStepRow;
import com.init.workflowruntime.domain.WorkflowExecution;
import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class WorkspaceWorkflowBottleneckAnalysisService {

  private static final ZoneId METRIC_ZONE = ZoneId.of("Asia/Seoul");
  private static final int TOP_LIMIT = 5;
  private static final String UNKNOWN_STATE = "미확인 state";
  private static final String WORKSPACE_ACCESS_DENIED_MESSAGE = "워크스페이스에 접근 권한이 없습니다.";

  private final WorkflowBottleneckAnalysisRepository analysisRepository;
  private final WorkspaceMemberRepository workspaceMemberRepository;
  private final ObjectMapper objectMapper;
  private final Clock clock;

  public WorkspaceWorkflowBottleneckAnalysisService(
      WorkflowBottleneckAnalysisRepository analysisRepository,
      WorkspaceMemberRepository workspaceMemberRepository,
      ObjectMapper objectMapper,
      Clock clock) {
    this.analysisRepository = analysisRepository;
    this.workspaceMemberRepository = workspaceMemberRepository;
    this.objectMapper = objectMapper;
    this.clock = clock;
  }

  public WorkspaceWorkflowBottleneckAnalysisResponse getAnalysis(
      GetWorkflowBottleneckAnalysisCommand command) {
    validateWorkspaceMembership(command.workspaceId(), command.userId());
    AnalysisPeriod period = resolvePeriod(command);
    List<WorkflowBottleneckExecutionRow> executions =
        analysisRepository.findExecutionRows(
            command.workspaceId(), command.workflowDefinitionId(), period.start(), period.end());
    List<WorkflowBottleneckStepRow> steps =
        analysisRepository.findStepRows(
            command.workspaceId(), command.workflowDefinitionId(), period.start(), period.end());
    List<WorkflowBottleneckDecisionRow> decisions =
        analysisRepository.findDecisionRows(
            command.workspaceId(), command.workflowDefinitionId(), period.start(), period.end());

    Map<String, StateAggregate> states = new LinkedHashMap<>();
    List<WorkflowTransitionMetricResponse> transitions = aggregateTransitions(steps, states);
    WorkflowStateBottleneckResponse longestDwell = aggregateDwell(steps, states);
    WorkflowStateBottleneckResponse mostStopped = aggregateStoppedExecutions(executions, states);
    HitAggregation missingSlots = aggregateHits(decisions, HitType.MISSING_SLOT, states);
    HitAggregation policyHits = aggregateHits(decisions, HitType.POLICY_HIT, states);
    HitAggregation riskHits = aggregateHits(decisions, HitType.RISK_HIT, states);
    List<WorkflowHumanInterventionMetricResponse> handoffPoints =
        aggregateHumanInterventions(steps, decisions, states);

    long completed = countStatus(executions, WorkflowExecution.STATUS_COMPLETED);
    long failed = countStatus(executions, WorkflowExecution.STATUS_FAILED);
    long running = executions.size() - completed - failed;

    return new WorkspaceWorkflowBottleneckAnalysisResponse(
        command.workspaceId(),
        command.workflowDefinitionId(),
        period.start(),
        period.end(),
        executions.size(),
        completed,
        failed,
        running,
        transitions,
        longestDwell,
        mostStopped,
        toStateMetrics(states),
        missingSlots.topHits(),
        policyHits.topHits(),
        riskHits.topHits(),
        handoffPoints,
        buildImprovementHints(missingSlots, policyHits, riskHits, longestDwell, mostStopped));
  }

  private void validateWorkspaceMembership(Long workspaceId, Long userId) {
    workspaceMemberRepository
        .findByWorkspaceIdAndUserId(workspaceId, userId)
        .orElseThrow(() -> new WorkspaceAccessDeniedException(WORKSPACE_ACCESS_DENIED_MESSAGE));
  }

  private AnalysisPeriod resolvePeriod(GetWorkflowBottleneckAnalysisCommand command) {
    boolean hasFrom = command.fromDate() != null;
    boolean hasTo = command.toDate() != null;
    if (hasFrom != hasTo) {
      throw new BadRequestException(
          "INVALID_WORKFLOW_BOTTLENECK_PERIOD", "fromDate and toDate must be provided together");
    }

    LocalDate startDate;
    LocalDate endDateExclusive;
    if (hasFrom) {
      startDate = command.fromDate();
      endDateExclusive = command.toDate().plusDays(1);
    } else {
      LocalDate today = LocalDate.now(clock.withZone(METRIC_ZONE));
      startDate = today.minusDays(6);
      endDateExclusive = today.plusDays(1);
    }

    if (!endDateExclusive.isAfter(startDate)) {
      throw new BadRequestException(
          "INVALID_WORKFLOW_BOTTLENECK_PERIOD", "toDate must be on or after fromDate");
    }

    return new AnalysisPeriod(
        startDate.atStartOfDay(METRIC_ZONE).toOffsetDateTime(),
        endDateExclusive.atStartOfDay(METRIC_ZONE).toOffsetDateTime());
  }

  private List<WorkflowTransitionMetricResponse> aggregateTransitions(
      List<WorkflowBottleneckStepRow> steps, Map<String, StateAggregate> states) {
    Map<String, TransitionAggregate> transitions = new LinkedHashMap<>();
    for (WorkflowBottleneckStepRow step : steps) {
      String stateTo = normalizeState(step.stateTo());
      if (stateTo != null) {
        states.computeIfAbsent(stateTo, StateAggregate::new).transitionInCount++;
      }
      String stateFrom = normalizeState(step.stateFrom());
      if (stateFrom != null) {
        states.computeIfAbsent(stateFrom, StateAggregate::new).transitionOutCount++;
      }
      if (stateTo == null) {
        continue;
      }
      String key = (stateFrom == null ? "" : stateFrom) + "->" + stateTo;
      transitions.computeIfAbsent(key, ignored -> new TransitionAggregate(stateFrom, stateTo))
          .passCount++;
    }
    return transitions.values().stream()
        .sorted(
            Comparator.comparingLong(TransitionAggregate::passCount)
                .reversed()
                .thenComparing(TransitionAggregate::stateTo))
        .map(
            transition ->
                new WorkflowTransitionMetricResponse(
                    transition.stateFrom(), transition.stateTo(), transition.passCount()))
        .toList();
  }

  private WorkflowStateBottleneckResponse aggregateDwell(
      List<WorkflowBottleneckStepRow> steps, Map<String, StateAggregate> states) {
    Map<Long, WorkflowBottleneckStepRow> previousByExecution = new LinkedHashMap<>();
    for (WorkflowBottleneckStepRow step : steps) {
      WorkflowBottleneckStepRow previous = previousByExecution.put(step.executionId(), step);
      if (previous == null || previous.createdAt() == null || step.createdAt() == null) {
        continue;
      }
      String state = normalizeState(previous.stateTo());
      if (state == null || step.createdAt().isBefore(previous.createdAt())) {
        continue;
      }
      long seconds = Duration.between(previous.createdAt(), step.createdAt()).getSeconds();
      StateAggregate aggregate = states.computeIfAbsent(state, StateAggregate::new);
      aggregate.dwellSecondsSum += seconds;
      aggregate.dwellSampleCount++;
    }
    return states.values().stream()
        .filter(state -> state.dwellSampleCount > 0)
        .max(Comparator.comparingLong(StateAggregate::averageDwellSeconds))
        .map(
            state ->
                new WorkflowStateBottleneckResponse(
                    state.stateName,
                    state.averageDwellSeconds(),
                    state.dwellSampleCount,
                    "평균 %d초 동안 머문 state".formatted(state.averageDwellSeconds())))
        .orElse(null);
  }

  private WorkflowStateBottleneckResponse aggregateStoppedExecutions(
      List<WorkflowBottleneckExecutionRow> executions, Map<String, StateAggregate> states) {
    for (WorkflowBottleneckExecutionRow execution : executions) {
      if (WorkflowExecution.STATUS_COMPLETED.equals(execution.status())) {
        continue;
      }
      String state = normalizeState(execution.currentState());
      if (state == null) {
        continue;
      }
      states.computeIfAbsent(state, StateAggregate::new).stoppedCount++;
    }
    return states.values().stream()
        .filter(state -> state.stoppedCount > 0)
        .max(Comparator.comparingLong(StateAggregate::stoppedCount))
        .map(
            state ->
                new WorkflowStateBottleneckResponse(
                    state.stateName,
                    state.stoppedCount,
                    state.stoppedCount,
                    "실패/진행 중 실행이 가장 많이 멈춘 state"))
        .orElse(null);
  }

  private HitAggregation aggregateHits(
      List<WorkflowBottleneckDecisionRow> decisions,
      HitType hitType,
      Map<String, StateAggregate> states) {
    Map<String, HitAggregate> hits = new LinkedHashMap<>();
    for (WorkflowBottleneckDecisionRow decision : decisions) {
      String state = normalizeState(decision.stateName());
      String stateName = state != null ? state : UNKNOWN_STATE;
      for (String name : parseHitNames(jsonFor(decision, hitType))) {
        hits.computeIfAbsent(name, ignored -> new HitAggregate(name, hitType)).increment(stateName);
        StateAggregate stateAggregate = states.computeIfAbsent(stateName, StateAggregate::new);
        switch (hitType) {
          case MISSING_SLOT -> stateAggregate.missingSlotCount++;
          case POLICY_HIT -> stateAggregate.policyHitCount++;
          case RISK_HIT -> stateAggregate.riskHitCount++;
        }
      }
    }
    List<WorkflowHitMetricResponse> topHits =
        hits.values().stream()
            .sorted(
                Comparator.comparingLong(HitAggregate::count)
                    .reversed()
                    .thenComparing(HitAggregate::name))
            .limit(TOP_LIMIT)
            .map(HitAggregate::toResponse)
            .toList();
    return new HitAggregation(hitType, topHits);
  }

  private List<WorkflowHumanInterventionMetricResponse> aggregateHumanInterventions(
      List<WorkflowBottleneckStepRow> steps,
      List<WorkflowBottleneckDecisionRow> decisions,
      Map<String, StateAggregate> states) {
    Map<String, Long> points = new LinkedHashMap<>();
    for (WorkflowBottleneckStepRow step : steps) {
      if (!isHandoffAction(step.actionType())) {
        continue;
      }
      String state = normalizeState(step.stateTo());
      if (state == null) {
        state = normalizeState(step.stateFrom());
      }
      if (state == null) {
        state = UNKNOWN_STATE;
      }
      points.merge(state, 1L, Long::sum);
      states.computeIfAbsent(state, StateAggregate::new).humanInterventionCount++;
    }
    for (WorkflowBottleneckDecisionRow decision : decisions) {
      if (!isHandoffAction(decision.selectedAction())) {
        continue;
      }
      String state = normalizeState(decision.stateName());
      if (state == null) {
        state = UNKNOWN_STATE;
      }
      points.merge(state, 1L, Long::sum);
      states.computeIfAbsent(state, StateAggregate::new).humanInterventionCount++;
    }
    return points.entrySet().stream()
        .sorted(
            Map.Entry.<String, Long>comparingByValue().reversed().thenComparing(Map.Entry::getKey))
        .limit(TOP_LIMIT)
        .map(
            entry ->
                new WorkflowHumanInterventionMetricResponse(
                    entry.getKey(), entry.getValue(), "상담사 개입 action이 자주 발생한 state"))
        .toList();
  }

  private List<WorkflowHitMetricResponse> toStateMetrics(Map<String, StateAggregate> states) {
    return states.values().stream()
        .filter(StateAggregate::hasSignal)
        .sorted(
            Comparator.comparingLong(StateAggregate::totalSignalCount)
                .reversed()
                .thenComparing(StateAggregate::stateName))
        .limit(TOP_LIMIT)
        .map(
            state ->
                new WorkflowHitMetricResponse(
                    state.stateName,
                    state.totalSignalCount(),
                    state.stateName,
                    "전이/정지/slot/policy/risk/handoff 신호가 누적된 state"))
        .toList();
  }

  private List<String> buildImprovementHints(
      HitAggregation missingSlots,
      HitAggregation policyHits,
      HitAggregation riskHits,
      WorkflowStateBottleneckResponse longestDwell,
      WorkflowStateBottleneckResponse mostStopped) {
    List<String> hints = new ArrayList<>();
    missingSlots.topHits().stream()
        .findFirst()
        .ifPresent(hit -> hints.add("%s slot 수집 문구와 검증 규칙을 우선 점검하세요.".formatted(hit.name())));
    policyHits.topHits().stream()
        .findFirst()
        .ifPresent(hit -> hints.add("%s policy 조건과 예외 처리를 검토하세요.".formatted(hit.name())));
    riskHits.topHits().stream()
        .findFirst()
        .ifPresent(hit -> hints.add("%s risk 감지 기준과 상담사 연결 기준을 확인하세요.".formatted(hit.name())));
    if (longestDwell != null) {
      hints.add("%s에서 머무는 시간이 길어 다음 안내 문구나 조건을 점검하세요.".formatted(longestDwell.stateName()));
    }
    if (mostStopped != null) {
      hints.add("%s에서 실패/진행 중 실행이 많이 남아 종료 조건을 확인하세요.".formatted(mostStopped.stateName()));
    }
    if (hints.isEmpty()) {
      hints.add("선택 기간에 개선 우선순위를 판단할 병목 신호가 아직 충분하지 않습니다.");
    }
    return hints.stream().limit(TOP_LIMIT).toList();
  }

  private long countStatus(List<WorkflowBottleneckExecutionRow> executions, String status) {
    return executions.stream().filter(row -> status.equals(row.status())).count();
  }

  private String jsonFor(WorkflowBottleneckDecisionRow decision, HitType hitType) {
    return switch (hitType) {
      case MISSING_SLOT -> decision.missingSlotsJson();
      case POLICY_HIT -> decision.policyHitsJson();
      case RISK_HIT -> decision.riskHitsJson();
    };
  }

  private List<String> parseHitNames(String rawJson) {
    if (rawJson == null || rawJson.isBlank()) {
      return List.of();
    }
    try {
      JsonNode root = objectMapper.readTree(rawJson);
      if (!root.isArray()) {
        return List.of();
      }
      List<String> names = new ArrayList<>();
      for (JsonNode item : root) {
        String name = extractHitName(item);
        if (name != null) {
          names.add(name);
        }
      }
      return names;
    } catch (JsonProcessingException ignored) {
      return List.of();
    }
  }

  private String extractHitName(JsonNode item) {
    if (item == null || item.isNull()) {
      return null;
    }
    if (item.isTextual() || item.isNumber() || item.isBoolean()) {
      return normalizeName(item.asText());
    }
    if (item.isObject()) {
      for (String field :
          List.of(
              "slotCode",
              "policyCode",
              "riskCode",
              "code",
              "name",
              "id",
              "ref",
              "slotRef",
              "policyRef",
              "riskRef")) {
        JsonNode value = item.get(field);
        if (value != null && value.isValueNode()) {
          String normalized = normalizeName(value.asText());
          if (normalized != null) {
            return normalized;
          }
        }
      }
    }
    return null;
  }

  private boolean isHandoffAction(String action) {
    if (action == null) {
      return false;
    }
    String normalized = action.trim().toUpperCase();
    return normalized.contains("HANDOFF") || normalized.contains("COUNSELOR");
  }

  private String normalizeState(String value) {
    return normalizeName(value);
  }

  private String normalizeName(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  private record AnalysisPeriod(OffsetDateTime start, OffsetDateTime end) {}

  private enum HitType {
    MISSING_SLOT,
    POLICY_HIT,
    RISK_HIT
  }

  private static final class TransitionAggregate {
    private final String stateFrom;
    private final String stateTo;
    private long passCount;

    private TransitionAggregate(String stateFrom, String stateTo) {
      this.stateFrom = stateFrom;
      this.stateTo = stateTo;
    }

    String stateFrom() {
      return stateFrom;
    }

    String stateTo() {
      return stateTo;
    }

    long passCount() {
      return passCount;
    }
  }

  private record HitAggregation(HitType hitType, List<WorkflowHitMetricResponse> topHits) {}

  private static final class HitAggregate {
    private final String name;
    private final HitType hitType;
    private final Map<String, Long> stateCounts = new LinkedHashMap<>();
    private long count;

    private HitAggregate(String name, HitType hitType) {
      this.name = name;
      this.hitType = hitType;
    }

    void increment(String stateName) {
      count++;
      stateCounts.merge(stateName, 1L, Long::sum);
    }

    long count() {
      return count;
    }

    String name() {
      return name;
    }

    WorkflowHitMetricResponse toResponse() {
      String stateName = dominantStateName();
      String description =
          switch (hitType) {
            case MISSING_SLOT -> stateName + "에서 자주 비어 있는 slot";
            case POLICY_HIT -> stateName + "에서 자주 hit 된 policy";
            case RISK_HIT -> stateName + "에서 자주 hit 된 risk";
          };
      return new WorkflowHitMetricResponse(name, count, stateName, description);
    }

    private String dominantStateName() {
      return stateCounts.entrySet().stream()
          .max(Map.Entry.<String, Long>comparingByValue().thenComparing(Map.Entry::getKey))
          .map(Map.Entry::getKey)
          .orElse(UNKNOWN_STATE);
    }
  }

  private static final class StateAggregate {
    private final String stateName;
    private long transitionInCount;
    private long transitionOutCount;
    private long stoppedCount;
    private long missingSlotCount;
    private long policyHitCount;
    private long riskHitCount;
    private long humanInterventionCount;
    private long dwellSecondsSum;
    private long dwellSampleCount;

    private StateAggregate(String stateName) {
      this.stateName = Objects.requireNonNull(stateName);
    }

    String stateName() {
      return stateName;
    }

    long stoppedCount() {
      return stoppedCount;
    }

    long averageDwellSeconds() {
      return dwellSampleCount == 0 ? 0 : Math.round((double) dwellSecondsSum / dwellSampleCount);
    }

    boolean hasSignal() {
      return totalSignalCount() > 0;
    }

    long totalSignalCount() {
      return transitionInCount
          + transitionOutCount
          + stoppedCount
          + missingSlotCount
          + policyHitCount
          + riskHitCount
          + humanInterventionCount;
    }
  }
}
