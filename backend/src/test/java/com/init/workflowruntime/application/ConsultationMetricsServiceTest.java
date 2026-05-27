package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.workflowruntime.application.dto.ConsultationMetricsResponse;
import com.init.workflowruntime.domain.ConsultationMetricsRepository;
import com.init.workflowruntime.domain.ConsultationMetricsSessionFact;
import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.domain.model.WorkspaceMember;
import com.init.workspace.domain.model.WorkspaceMemberRole;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import java.time.Clock;
import java.time.Instant;
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
@DisplayName("ConsultationMetricsService")
class ConsultationMetricsServiceTest {

  private static final Long WORKSPACE_ID = 2L;
  private static final Long USER_ID = 7L;
  private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

  @Mock private ConsultationMetricsRepository consultationMetricsRepository;
  @Mock private WorkspaceMemberRepository workspaceMemberRepository;

  private ConsultationMetricsService service;

  @BeforeEach
  void setUp() {
    Clock clock = Clock.fixed(Instant.parse("2026-05-27T03:00:00Z"), SEOUL);
    service =
        new ConsultationMetricsService(
            consultationMetricsRepository, workspaceMemberRepository, clock);
  }

  @Test
  @DisplayName("LLM/인간/혼합 세션을 독립 지표로 집계한다")
  void should_aggregateSplitMetrics_when_sessionsHaveLlmAndHumanResponses() {
    OffsetDateTime base = OffsetDateTime.parse("2026-05-27T09:00:00+09:00");
    givenMember();
    given(consultationMetricsRepository.findSessionFacts(WORKSPACE_ID, periodStart(), periodEnd()))
        .willReturn(
            List.of(
                fact(1L, base, base.plusSeconds(3), base.plusSeconds(3), null, true, true, false),
                fact(
                    2L,
                    base,
                    base.plusSeconds(420),
                    null,
                    base.plusSeconds(420),
                    true,
                    false,
                    true),
                fact(
                    3L,
                    base,
                    base.plusSeconds(2),
                    base.plusSeconds(2),
                    base.plusSeconds(300),
                    true,
                    true,
                    true)));

    ConsultationMetricsResponse response = service.getWorkspaceMetrics(WORKSPACE_ID, USER_ID);

    assertThat(response.workspaceId()).isEqualTo(WORKSPACE_ID);
    assertThat(response.periodStart()).isEqualTo(periodStart());
    assertThat(response.periodEnd()).isEqualTo(periodEnd());
    assertThat(response.averageFirstResponseSeconds()).isEqualTo(142L);
    assertThat(response.averageLlmFirstResponseSeconds()).isEqualTo(3L);
    assertThat(response.averageHumanFirstResponseSeconds()).isEqualTo(360L);
    assertThat(response.handledTodayCount()).isEqualTo(3);
    assertThat(response.llmHandledTodayCount()).isEqualTo(1);
    assertThat(response.humanHandledTodayCount()).isEqualTo(2);
  }

  @Test
  @DisplayName("고객 메시지나 응답이 없는 세션은 평균에서 제외한다")
  void should_returnNullAverages_when_noMeasurableResponsesExist() {
    OffsetDateTime base = OffsetDateTime.parse("2026-05-27T09:00:00+09:00");
    givenMember();
    given(consultationMetricsRepository.findSessionFacts(WORKSPACE_ID, periodStart(), periodEnd()))
        .willReturn(
            List.of(
                fact(1L, null, null, null, null, false, true, false),
                fact(2L, base, null, null, null, false, false, false)));

    ConsultationMetricsResponse response = service.getWorkspaceMetrics(WORKSPACE_ID, USER_ID);

    assertThat(response.averageFirstResponseSeconds()).isNull();
    assertThat(response.averageLlmFirstResponseSeconds()).isNull();
    assertThat(response.averageHumanFirstResponseSeconds()).isNull();
    assertThat(response.handledTodayCount()).isZero();
    assertThat(response.llmHandledTodayCount()).isZero();
    assertThat(response.humanHandledTodayCount()).isZero();
  }

  @Test
  @DisplayName("워크스페이스 멤버가 아니면 접근을 거부한다")
  void should_throwAccessDenied_when_userIsNotWorkspaceMember() {
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(WORKSPACE_ID, USER_ID))
        .willReturn(Optional.empty());

    assertThatThrownBy(() -> service.getWorkspaceMetrics(WORKSPACE_ID, USER_ID))
        .isInstanceOf(WorkspaceAccessDeniedException.class);
    verify(consultationMetricsRepository, never())
        .findSessionFacts(WORKSPACE_ID, periodStart(), periodEnd());
  }

  private void givenMember() {
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(WORKSPACE_ID, USER_ID))
        .willReturn(
            Optional.of(WorkspaceMember.create(WORKSPACE_ID, USER_ID, WorkspaceMemberRole.OWNER)));
  }

  private OffsetDateTime periodStart() {
    return OffsetDateTime.parse("2026-05-27T00:00:00+09:00");
  }

  private OffsetDateTime periodEnd() {
    return OffsetDateTime.parse("2026-05-28T00:00:00+09:00");
  }

  private ConsultationMetricsSessionFact fact(
      Long sessionId,
      OffsetDateTime firstCustomerAt,
      OffsetDateTime firstResponseAt,
      OffsetDateTime firstLlmResponseAt,
      OffsetDateTime firstHumanResponseAt,
      boolean handledToday,
      boolean hasLlmMessage,
      boolean hasHumanMessage) {
    return new ConsultationMetricsSessionFact(
        sessionId,
        firstCustomerAt,
        firstResponseAt,
        firstLlmResponseAt,
        firstHumanResponseAt,
        handledToday,
        hasLlmMessage,
        hasHumanMessage);
  }
}
