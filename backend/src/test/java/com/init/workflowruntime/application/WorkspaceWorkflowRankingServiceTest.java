package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;

import com.init.workflowruntime.application.command.GetWorkspaceWorkflowRankingsCommand;
import com.init.workflowruntime.application.dto.WorkspaceWorkflowRankingResponse;
import com.init.workflowruntime.domain.WorkflowExecution;
import com.init.workflowruntime.domain.WorkflowRankingExecutionRow;
import com.init.workflowruntime.domain.WorkflowRankingRepository;
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
@DisplayName("WorkspaceWorkflowRankingService")
class WorkspaceWorkflowRankingServiceTest {

  private static final Long WORKSPACE_ID = 2L;
  private static final Long USER_ID = 7L;
  private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

  @Mock private WorkflowRankingRepository workflowRankingRepository;
  @Mock private WorkspaceMemberRepository workspaceMemberRepository;

  private WorkspaceWorkflowRankingService service;

  @BeforeEach
  void setUp() {
    Clock clock = Clock.fixed(Instant.parse("2026-05-27T03:00:00Z"), SEOUL);
    service =
        new WorkspaceWorkflowRankingService(
            workflowRankingRepository, workspaceMemberRepository, clock);
  }

  @Test
  @DisplayName("현재/전 기간 workflow 실행량으로 랭킹 지표를 계산한다")
  void should_calculateWorkflowRankingMetrics_when_executionRowsExist() {
    OffsetDateTime start = OffsetDateTime.parse("2026-05-21T00:00:00+09:00");
    OffsetDateTime end = OffsetDateTime.parse("2026-05-28T00:00:00+09:00");
    OffsetDateTime previousStart = OffsetDateTime.parse("2026-05-14T00:00:00+09:00");
    givenMember();
    given(workflowRankingRepository.countOperationalConsultations(WORKSPACE_ID, start, end))
        .willReturn(10L);
    given(workflowRankingRepository.findExecutionRows(WORKSPACE_ID, start, end))
        .willReturn(
            List.of(
                row(
                    1L,
                    100L,
                    "refund_flow",
                    "환불 처리",
                    WorkflowExecution.STATUS_COMPLETED,
                    at("2026-05-21T09:00:00+09:00"),
                    at("2026-05-21T09:02:00+09:00"),
                    false),
                row(
                    2L,
                    100L,
                    "refund_flow",
                    "환불 처리",
                    WorkflowExecution.STATUS_COMPLETED,
                    at("2026-05-21T10:00:00+09:00"),
                    at("2026-05-21T10:04:00+09:00"),
                    true),
                row(
                    3L,
                    100L,
                    "refund_flow",
                    "환불 처리",
                    WorkflowExecution.STATUS_FAILED,
                    at("2026-05-21T11:00:00+09:00"),
                    null,
                    false),
                new WorkflowRankingExecutionRow(
                    4L,
                    null,
                    null,
                    null,
                    null,
                    null,
                    WorkflowExecution.STATUS_RUNNING,
                    at("2026-05-21T12:00:00+09:00"),
                    null,
                    true)));
    given(workflowRankingRepository.findExecutionRows(WORKSPACE_ID, previousStart, start))
        .willReturn(
            List.of(
                row(
                    5L,
                    100L,
                    "refund_flow",
                    "환불 처리",
                    WorkflowExecution.STATUS_COMPLETED,
                    at("2026-05-14T09:00:00+09:00"),
                    at("2026-05-14T09:03:00+09:00"),
                    false)));

    WorkspaceWorkflowRankingResponse response =
        service.getRankings(
            new GetWorkspaceWorkflowRankingsCommand(
                WORKSPACE_ID,
                USER_ID,
                LocalDate.parse("2026-05-21"),
                LocalDate.parse("2026-05-27")));

    assertThat(response.periodStart()).isEqualTo(start);
    assertThat(response.periodEnd()).isEqualTo(end);
    assertThat(response.totalConsultationCount()).isEqualTo(10);
    assertThat(response.rankings()).hasSize(2);
    assertThat(response.topRankings()).hasSize(2);

    var refund = response.rankings().get(0);
    assertThat(refund.rank()).isEqualTo(1);
    assertThat(refund.workflowDefinitionId()).isEqualTo(100L);
    assertThat(refund.executionCount()).isEqualTo(3);
    assertThat(refund.shareRate()).isEqualTo(30.0);
    assertThat(refund.completedCount()).isEqualTo(2);
    assertThat(refund.failedCount()).isEqualTo(1);
    assertThat(refund.runningCount()).isZero();
    assertThat(refund.completionRate()).isEqualTo(66.7);
    assertThat(refund.failureRate()).isEqualTo(33.3);
    assertThat(refund.averageHandlingSeconds()).isEqualTo(180L);
    assertThat(refund.humanInterventionRate()).isEqualTo(33.3);
    assertThat(refund.changeRate()).isEqualTo(200.0);
    assertThat(refund.surging()).isTrue();
    assertThat(refund.detailPath())
        .isEqualTo("/workspaces/2/domain-packs/11/workflows/100?versionId=22");

    var unknown = response.rankings().get(1);
    assertThat(unknown.workflowName()).isEqualTo("미확인 워크플로우");
    assertThat(unknown.detailPath()).isNull();
    assertThat(unknown.runningCount()).isEqualTo(1);
    assertThat(unknown.humanInterventionRate()).isEqualTo(100.0);
  }

  @Test
  @DisplayName("워크스페이스 멤버가 아니면 랭킹 조회를 거부한다")
  void should_throwAccessDenied_when_userIsNotWorkspaceMember() {
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(WORKSPACE_ID, USER_ID))
        .willReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                service.getRankings(new GetWorkspaceWorkflowRankingsCommand(WORKSPACE_ID, USER_ID)))
        .isInstanceOf(WorkspaceAccessDeniedException.class);
    verifyNoInteractions(workflowRankingRepository);
  }

  private void givenMember() {
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(WORKSPACE_ID, USER_ID))
        .willReturn(
            Optional.of(WorkspaceMember.create(WORKSPACE_ID, USER_ID, WorkspaceMemberRole.OWNER)));
  }

  private WorkflowRankingExecutionRow row(
      Long executionId,
      Long workflowDefinitionId,
      String workflowCode,
      String workflowName,
      String status,
      OffsetDateTime startedAt,
      OffsetDateTime finishedAt,
      boolean hasHumanMessage) {
    return new WorkflowRankingExecutionRow(
        executionId,
        workflowDefinitionId,
        11L,
        22L,
        workflowCode,
        workflowName,
        status,
        startedAt,
        finishedAt,
        hasHumanMessage);
  }

  private OffsetDateTime at(String value) {
    return OffsetDateTime.parse(value);
  }
}
