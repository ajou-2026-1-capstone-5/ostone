package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.workflowruntime.application.command.GetWorkflowBottleneckAnalysisCommand;
import com.init.workflowruntime.application.dto.WorkspaceWorkflowBottleneckAnalysisResponse;
import com.init.workflowruntime.domain.WorkflowBottleneckAnalysisRepository;
import com.init.workflowruntime.domain.WorkflowBottleneckDecisionRow;
import com.init.workflowruntime.domain.WorkflowBottleneckExecutionRow;
import com.init.workflowruntime.domain.WorkflowBottleneckStepRow;
import com.init.workflowruntime.domain.WorkflowExecution;
import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.domain.model.WorkspaceMember;
import com.init.workspace.domain.model.WorkspaceMemberRole;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("WorkspaceWorkflowBottleneckAnalysisService")
class WorkspaceWorkflowBottleneckAnalysisServiceTest {

  private static final Long WORKSPACE_ID = 2L;
  private static final Long USER_ID = 7L;
  private static final Long WORKFLOW_ID = 100L;
  private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

  @Mock private WorkflowBottleneckAnalysisRepository analysisRepository;
  @Mock private WorkspaceMemberRepository workspaceMemberRepository;

  private WorkspaceWorkflowBottleneckAnalysisService service;

  @BeforeEach
  void setUp() {
    Clock clock = Clock.fixed(Instant.parse("2026-06-04T03:00:00Z"), SEOUL);
    service =
        new WorkspaceWorkflowBottleneckAnalysisService(
            analysisRepository, workspaceMemberRepository, new ObjectMapper(), clock);
  }

  @Test
  @DisplayName("상태 전이, 병목 state, TOP hit, 상담사 개입 지점을 계산한다")
  void should_calculateBottleneckAnalysis_when_runtimeLogsExist() {
    OffsetDateTime start = OffsetDateTime.parse("2026-05-29T00:00:00+09:00");
    OffsetDateTime end = OffsetDateTime.parse("2026-06-05T00:00:00+09:00");
    givenMember();
    given(analysisRepository.findExecutionRows(WORKSPACE_ID, WORKFLOW_ID, start, end))
        .willReturn(
            List.of(
                execution(1L, WorkflowExecution.STATUS_COMPLETED, "done"),
                execution(2L, WorkflowExecution.STATUS_FAILED, "verify_policy"),
                execution(3L, WorkflowExecution.STATUS_RUNNING, "collect_slots"),
                execution(4L, WorkflowExecution.STATUS_RUNNING, "verify_policy")));
    given(analysisRepository.findStepRows(WORKSPACE_ID, WORKFLOW_ID, start, end))
        .willReturn(
            List.of(
                step(1L, null, "collect_slots", "ASSIGN_INTENT", "2026-06-01T10:00:00+09:00"),
                step(1L, "collect_slots", "verify_policy", "ADVANCE", "2026-06-01T10:07:00+09:00"),
                step(1L, "verify_policy", "done", "COMPLETED", "2026-06-01T10:08:00+09:00"),
                step(2L, null, "collect_slots", "ASSIGN_INTENT", "2026-06-01T11:00:00+09:00"),
                step(
                    2L, "collect_slots", "verify_policy", "HANDOFF", "2026-06-01T11:05:00+09:00")));
    given(analysisRepository.findDecisionRows(WORKSPACE_ID, WORKFLOW_ID, start, end))
        .willReturn(
            List.of(
                decision(
                    1L,
                    "collect_slots",
                    null,
                    "[\"order_id\",{\"slotCode\":\"customer_name\"}]",
                    "[{\"policyCode\":\"refund_window\"}]",
                    "[]"),
                decision(2L, "verify_policy", "HANDOFF_REQUIRED", "[\"order_id\"]", "[]", "[]"),
                decision(3L, "collect_slots", null, "not-json", "[]", "[{\"riskCode\":\"vip\"}]")));

    WorkspaceWorkflowBottleneckAnalysisResponse response =
        service.getAnalysis(
            new GetWorkflowBottleneckAnalysisCommand(
                WORKSPACE_ID,
                USER_ID,
                WORKFLOW_ID,
                LocalDate.parse("2026-05-29"),
                LocalDate.parse("2026-06-04")));

    assertThat(response.totalExecutionCount()).isEqualTo(4);
    assertThat(response.completedCount()).isEqualTo(1);
    assertThat(response.failedCount()).isEqualTo(1);
    assertThat(response.runningCount()).isEqualTo(2);
    assertThat(response.transitions())
        .anySatisfy(
            transition -> {
              assertThat(transition.stateFrom()).isEqualTo("collect_slots");
              assertThat(transition.stateTo()).isEqualTo("verify_policy");
              assertThat(transition.passCount()).isEqualTo(2);
            });
    assertThat(response.longestDwellState().stateName()).isEqualTo("collect_slots");
    assertThat(response.longestDwellState().metricValue()).isEqualTo(360);
    assertThat(response.mostStoppedState().stateName()).isEqualTo("verify_policy");
    assertThat(response.missingSlotTop().get(0).name()).isEqualTo("order_id");
    assertThat(response.missingSlotTop().get(0).count()).isEqualTo(2);
    assertThat(response.policyHitTop().get(0).name()).isEqualTo("refund_window");
    assertThat(response.riskHitTop().get(0).name()).isEqualTo("vip");
    assertThat(response.humanInterventionPoints().get(0).stateName()).isEqualTo("verify_policy");
    assertThat(response.improvementHints())
        .anySatisfy(hint -> assertThat(hint).contains("order_id"));
  }

  @Test
  @DisplayName("워크스페이스 멤버가 아니면 분석 조회를 거부한다")
  void should_throwAccessDenied_when_userIsNotWorkspaceMember() {
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(WORKSPACE_ID, USER_ID))
        .willReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                service.getAnalysis(
                    new GetWorkflowBottleneckAnalysisCommand(WORKSPACE_ID, USER_ID, WORKFLOW_ID)))
        .isInstanceOf(WorkspaceAccessDeniedException.class);
    verifyNoInteractions(analysisRepository);
  }

  private void givenMember() {
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(WORKSPACE_ID, USER_ID))
        .willReturn(
            Optional.of(WorkspaceMember.create(WORKSPACE_ID, USER_ID, WorkspaceMemberRole.OWNER)));
  }

  private WorkflowBottleneckExecutionRow execution(Long id, String status, String currentState) {
    return new WorkflowBottleneckExecutionRow(
        id, status, currentState, OffsetDateTime.parse("2026-06-01T09:00:00+09:00"), null);
  }

  private WorkflowBottleneckStepRow step(
      Long executionId, String from, String to, String actionType, String createdAt) {
    return new WorkflowBottleneckStepRow(
        executionId, from, to, actionType, OffsetDateTime.parse(createdAt));
  }

  private WorkflowBottleneckDecisionRow decision(
      Long executionId,
      String state,
      String selectedAction,
      String missingSlotsJson,
      String policyHitsJson,
      String riskHitsJson) {
    return new WorkflowBottleneckDecisionRow(
        executionId,
        state,
        selectedAction,
        missingSlotsJson,
        policyHitsJson,
        riskHitsJson,
        OffsetDateTime.parse("2026-06-01T09:00:00+09:00"));
  }
}
