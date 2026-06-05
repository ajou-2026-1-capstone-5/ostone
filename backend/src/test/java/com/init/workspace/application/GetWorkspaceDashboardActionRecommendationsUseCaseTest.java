package com.init.workspace.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.application.exception.WorkspaceNotFoundException;
import com.init.workspace.domain.model.WorkspaceMember;
import com.init.workspace.domain.model.WorkspaceMemberRole;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import com.init.workspace.domain.repository.WorkspaceRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("GetWorkspaceDashboardActionRecommendationsUseCase")
class GetWorkspaceDashboardActionRecommendationsUseCaseTest {

  @Mock private WorkspaceRepository workspaceRepository;
  @Mock private WorkspaceMemberRepository workspaceMemberRepository;
  @Mock private WorkspaceDashboardQueryPort workspaceDashboardQueryPort;

  private GetWorkspaceDashboardActionRecommendationsUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase =
        new GetWorkspaceDashboardActionRecommendationsUseCase(
            workspaceRepository,
            workspaceMemberRepository,
            workspaceDashboardQueryPort,
            Clock.fixed(Instant.parse("2026-06-04T00:00:00Z"), ZoneId.of("Asia/Seoul")));
  }

  @Test
  @DisplayName("추천 후보가 여러 개이면 priority 기준 최대 3개 반환")
  void should_top3반환_when_추천후보가여러개() {
    givenMember();
    given(
            workspaceDashboardQueryPort.findRecommendationSignals(
                1L,
                odt("2026-05-29T00:00:00+09:00"),
                odt("2026-06-05T00:00:00+09:00"),
                odt("2026-05-22T00:00:00+09:00")))
        .willReturn(signalsWithManyCandidates());

    WorkspaceDashboardActionRecommendationsResult result =
        useCase.execute(
            new GetWorkspaceDashboardActionRecommendationsCommand(
                1L, 7L, LocalDate.parse("2026-05-29"), LocalDate.parse("2026-06-04")));

    assertThat(result.recommendations())
        .extracting(WorkspaceDashboardActionRecommendationResult::ruleCode)
        .containsExactly("PIPELINE_FAILED", "RISK_HIT_SURGE", "HOTPATH_SURGE");
    assertThat(result.recommendations()).hasSize(3);
    assertThat(result.recommendations().get(0).targetPath())
        .isEqualTo("/workspaces/1/upload?jobId=77");
  }

  @Test
  @DisplayName("선행 지표가 없으면 rule을 안전하게 skip")
  void should_skip_when_선행지표없음() {
    givenMember();
    given(
            workspaceDashboardQueryPort.findRecommendationSignals(
                1L,
                odt("2026-06-04T00:00:00+09:00"),
                odt("2026-06-05T00:00:00+09:00"),
                odt("2026-06-03T00:00:00+09:00")))
        .willReturn(emptySignals());

    WorkspaceDashboardActionRecommendationsResult result =
        useCase.execute(new GetWorkspaceDashboardActionRecommendationsCommand(1L, 7L, null, null));

    assertThat(result.recommendations()).isEmpty();
  }

  @Test
  @DisplayName("시뮬레이션 신호도 운영 지표 추천과 같은 priority 체계로 정렬")
  void should_priority정렬_when_시뮬레이션추천포함() {
    givenMember();
    given(
            workspaceDashboardQueryPort.findRecommendationSignals(
                1L,
                odt("2026-06-04T00:00:00+09:00"),
                odt("2026-06-05T00:00:00+09:00"),
                odt("2026-06-03T00:00:00+09:00")))
        .willReturn(signalsWithSimulationCandidates());

    WorkspaceDashboardActionRecommendationsResult result =
        useCase.execute(new GetWorkspaceDashboardActionRecommendationsCommand(1L, 7L, null, null));

    assertThat(result.recommendations())
        .extracting(WorkspaceDashboardActionRecommendationResult::ruleCode)
        .containsExactly(
            "PIPELINE_FAILED", "SIMULATION_OPEN_FEEDBACK", "SIMULATION_REVIEW_PENDING_CANDIDATE");
    assertThat(result.recommendations().get(1).sourceLabel()).isEqualTo("시뮬레이션에서 발견됨");
    assertThat(result.recommendations().get(1).evidenceValue()).isEqualTo("4건");
    assertThat(result.recommendations().get(1).targetPath())
        .isEqualTo("/workspaces/1/simulation?feedbackStatus=OPEN");
  }

  @Test
  @DisplayName("시뮬레이션 추천에 open feedback, review 대기 후보, 실패 검증 케이스 수 표시")
  void should_시뮬레이션카운트표시_when_시뮬레이션신호있음() {
    givenMember();
    given(
            workspaceDashboardQueryPort.findRecommendationSignals(
                1L,
                odt("2026-06-04T00:00:00+09:00"),
                odt("2026-06-05T00:00:00+09:00"),
                odt("2026-06-03T00:00:00+09:00")))
        .willReturn(signalsWithOnlySimulationCandidates());

    WorkspaceDashboardActionRecommendationsResult result =
        useCase.execute(new GetWorkspaceDashboardActionRecommendationsCommand(1L, 7L, null, null));

    assertThat(result.recommendations())
        .extracting(WorkspaceDashboardActionRecommendationResult::ruleCode)
        .containsExactly(
            "SIMULATION_OPEN_FEEDBACK",
            "SIMULATION_REVIEW_PENDING_CANDIDATE",
            "SIMULATION_GOLDEN_CASE_FAILED");
    assertThat(result.recommendations())
        .extracting(WorkspaceDashboardActionRecommendationResult::evidenceValue)
        .containsExactly("4건", "2건", "1건");
  }

  @ParameterizedTest
  @CsvSource({
    "INTENT_MISMATCH, Intent mismatch",
    "MISSING_SLOT_QUESTION, Missing slot",
    "INAPPROPRIATE_RESPONSE, 응답 문구",
    "POLICY_CONDITION_MISSING, Policy 조건",
    "RISK_HANDOFF_REQUIRED, Risk/handoff",
    "WORKFLOW_BRANCH_ERROR, Workflow 분기",
    "OTHER, 기타 feedback",
    "CUSTOM_TYPE, CUSTOM_TYPE"
  })
  @DisplayName("반복 시뮬레이션 피드백 유형을 추천 근거 라벨로 변환")
  void should_피드백유형라벨표시_when_반복시뮬레이션피드백있음(String feedbackType, String expectedLabel) {
    givenMember();
    given(
            workspaceDashboardQueryPort.findRecommendationSignals(
                1L,
                odt("2026-06-04T00:00:00+09:00"),
                odt("2026-06-05T00:00:00+09:00"),
                odt("2026-06-03T00:00:00+09:00")))
        .willReturn(signalsWithRepeatedSimulationFeedback(feedbackType));

    WorkspaceDashboardActionRecommendationsResult result =
        useCase.execute(new GetWorkspaceDashboardActionRecommendationsCommand(1L, 7L, null, null));

    assertThat(result.recommendations()).hasSize(1);
    assertThat(result.recommendations().getFirst().ruleCode())
        .isEqualTo("SIMULATION_REPEATED_FEEDBACK_TYPE");
    assertThat(result.recommendations().getFirst().evidenceLabel()).isEqualTo(expectedLabel);
    assertThat(result.recommendations().getFirst().evidenceValue()).isEqualTo("3건");
  }

  @Test
  @DisplayName("시뮬레이션 신호가 null이면 빈 신호로 처리")
  void should_emptySimulationSignals_when_시뮬레이션신호Null() {
    givenMember();
    given(
            workspaceDashboardQueryPort.findRecommendationSignals(
                1L,
                odt("2026-06-04T00:00:00+09:00"),
                odt("2026-06-05T00:00:00+09:00"),
                odt("2026-06-03T00:00:00+09:00")))
        .willReturn(signalsWithNullSimulationSignals());

    WorkspaceDashboardActionRecommendationsResult result =
        useCase.execute(new GetWorkspaceDashboardActionRecommendationsCommand(1L, 7L, null, null));

    assertThat(result.recommendations()).isEmpty();
  }

  @Test
  @DisplayName("workspace 없음 → WorkspaceNotFoundException")
  void should_WorkspaceNotFoundException_when_workspace없음() {
    given(workspaceRepository.existsById(1L)).willReturn(false);

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new GetWorkspaceDashboardActionRecommendationsCommand(1L, 7L, null, null)))
        .isInstanceOf(WorkspaceNotFoundException.class);
  }

  @Test
  @DisplayName("멤버 아님 → WorkspaceAccessDeniedException")
  void should_WorkspaceAccessDeniedException_when_멤버아님() {
    given(workspaceRepository.existsById(1L)).willReturn(true);
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 7L))
        .willReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new GetWorkspaceDashboardActionRecommendationsCommand(1L, 7L, null, null)))
        .isInstanceOf(WorkspaceAccessDeniedException.class);
  }

  private void givenMember() {
    given(workspaceRepository.existsById(1L)).willReturn(true);
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 7L))
        .willReturn(Optional.of(WorkspaceMember.create(1L, 7L, WorkspaceMemberRole.ADMIN)));
  }

  private WorkspaceDashboardRecommendationSignalsResult signalsWithManyCandidates() {
    OffsetDateTime now = odt("2026-06-03T10:00:00+09:00");
    WorkspaceDashboardHealthResult health =
        new WorkspaceDashboardHealthResult(
            new WorkspaceDashboardKnowledgePackResult(
                11L, "CS Pack", 22L, 4, odt("2026-04-01T00:00:00+09:00"), now, 77L),
            new WorkspaceDashboardLogUploadResult(8L, "june-log", "6월 상담 로그", "READY", now),
            new WorkspaceDashboardGenerationResult(77L, 8L, 11L, "FAILED", now, now, now, "boom"),
            0);
    return new WorkspaceDashboardRecommendationSignalsResult(
        odt("2026-05-29T00:00:00+09:00"),
        odt("2026-06-05T00:00:00+09:00"),
        health,
        new WorkspaceDashboardDecisionSignalResult(100, 30, 20, 15),
        new WorkspaceDashboardDecisionSignalResult(100, 10, 10, 3),
        workflow("환불 처리", 48, 87.5, 33.3),
        workflow("배송 확인", 10, 40.0, null),
        emptySimulationSignals());
  }

  private WorkspaceDashboardRecommendationSignalsResult emptySignals() {
    return new WorkspaceDashboardRecommendationSignalsResult(
        odt("2026-06-04T00:00:00+09:00"),
        odt("2026-06-05T00:00:00+09:00"),
        new WorkspaceDashboardHealthResult(null, null, null, 0),
        new WorkspaceDashboardDecisionSignalResult(0, 0, 0, 0),
        new WorkspaceDashboardDecisionSignalResult(0, 0, 0, 0),
        null,
        null,
        emptySimulationSignals());
  }

  private WorkspaceDashboardRecommendationSignalsResult signalsWithSimulationCandidates() {
    OffsetDateTime now = odt("2026-06-03T10:00:00+09:00");
    WorkspaceDashboardHealthResult health =
        new WorkspaceDashboardHealthResult(
            null,
            null,
            new WorkspaceDashboardGenerationResult(77L, 8L, 11L, "FAILED", now, now, now, "boom"),
            0);
    return new WorkspaceDashboardRecommendationSignalsResult(
        odt("2026-06-04T00:00:00+09:00"),
        odt("2026-06-05T00:00:00+09:00"),
        health,
        new WorkspaceDashboardDecisionSignalResult(0, 0, 0, 0),
        new WorkspaceDashboardDecisionSignalResult(0, 0, 0, 0),
        null,
        null,
        new WorkspaceDashboardSimulationSignalResult(4, 2, 1, "MISSING_SLOT_QUESTION", 3));
  }

  private WorkspaceDashboardRecommendationSignalsResult signalsWithOnlySimulationCandidates() {
    return new WorkspaceDashboardRecommendationSignalsResult(
        odt("2026-06-04T00:00:00+09:00"),
        odt("2026-06-05T00:00:00+09:00"),
        new WorkspaceDashboardHealthResult(null, null, null, 0),
        new WorkspaceDashboardDecisionSignalResult(0, 0, 0, 0),
        new WorkspaceDashboardDecisionSignalResult(0, 0, 0, 0),
        null,
        null,
        new WorkspaceDashboardSimulationSignalResult(4, 2, 1, "MISSING_SLOT_QUESTION", 3));
  }

  private WorkspaceDashboardRecommendationSignalsResult signalsWithRepeatedSimulationFeedback(
      String feedbackType) {
    return new WorkspaceDashboardRecommendationSignalsResult(
        odt("2026-06-04T00:00:00+09:00"),
        odt("2026-06-05T00:00:00+09:00"),
        new WorkspaceDashboardHealthResult(null, null, null, 0),
        new WorkspaceDashboardDecisionSignalResult(0, 0, 0, 0),
        new WorkspaceDashboardDecisionSignalResult(0, 0, 0, 0),
        null,
        null,
        new WorkspaceDashboardSimulationSignalResult(0, 0, 0, feedbackType, 3));
  }

  private WorkspaceDashboardRecommendationSignalsResult signalsWithNullSimulationSignals() {
    return new WorkspaceDashboardRecommendationSignalsResult(
        odt("2026-06-04T00:00:00+09:00"),
        odt("2026-06-05T00:00:00+09:00"),
        new WorkspaceDashboardHealthResult(null, null, null, 0),
        new WorkspaceDashboardDecisionSignalResult(0, 0, 0, 0),
        new WorkspaceDashboardDecisionSignalResult(0, 0, 0, 0),
        null,
        null,
        null);
  }

  private WorkspaceDashboardWorkflowRecommendationSignal workflow(
      String workflowName, long executionCount, Double completionRate, Double changeRate) {
    return new WorkspaceDashboardWorkflowRecommendationSignal(
        100L, 11L, 22L, workflowName, executionCount, completionRate, changeRate);
  }

  private WorkspaceDashboardSimulationSignalResult emptySimulationSignals() {
    return new WorkspaceDashboardSimulationSignalResult(0, 0, 0, null, 0);
  }

  private OffsetDateTime odt(String value) {
    return OffsetDateTime.parse(value);
  }
}
