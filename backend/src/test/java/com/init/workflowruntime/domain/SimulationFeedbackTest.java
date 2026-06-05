package com.init.workflowruntime.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.OffsetDateTime;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.test.util.ReflectionTestUtils;

@DisplayName("SimulationFeedback")
class SimulationFeedbackTest {

  @Test
  @DisplayName("create: 피드백 본문을 정규화하고 OPEN 상태로 생성한다")
  void shouldCreateFeedbackWithNormalizedContent() {
    SimulationFeedback feedback =
        SimulationFeedback.create(
            10L,
            55L,
            100L,
            new SimulationFeedbackContent(
                SimulationFeedbackType.MISSING_SLOT_QUESTION,
                "  주문번호를 묻지 않았습니다.  ",
                "  주문번호를 먼저 요청합니다.  ",
                SimulationFeedbackSeverity.HIGH),
            7L);

    assertThat(feedback.getWorkspaceId()).isEqualTo(10L);
    assertThat(feedback.getChatSessionId()).isEqualTo(55L);
    assertThat(feedback.getChatMessageId()).isEqualTo(100L);
    assertThat(feedback.getFeedbackType()).isEqualTo(SimulationFeedbackType.MISSING_SLOT_QUESTION);
    assertThat(feedback.getDescription()).isEqualTo("주문번호를 묻지 않았습니다.");
    assertThat(feedback.getExpectedBehavior()).isEqualTo("주문번호를 먼저 요청합니다.");
    assertThat(feedback.getSeverity()).isEqualTo(SimulationFeedbackSeverity.HIGH);
    assertThat(feedback.getStatus()).isEqualTo(SimulationFeedbackStatus.OPEN);
    assertThat(feedback.getCreatedBy()).isEqualTo(7L);
  }

  @Test
  @DisplayName("markCandidateCreated: OPEN 피드백을 후보 생성 상태로 전환한다")
  void shouldMarkCandidateCreated() {
    SimulationFeedback feedback = feedback();

    feedback.markCandidateCreated();

    assertThat(feedback.getStatus()).isEqualTo(SimulationFeedbackStatus.CANDIDATE_CREATED);
  }

  @Test
  @DisplayName("markCandidateCreated: OPEN이 아니면 후보 생성 상태로 전환할 수 없다")
  void shouldRejectCandidateCreatedTransition_whenFeedbackNotOpen() {
    SimulationFeedback feedback = feedback();
    feedback.markCandidateCreated();

    assertThatThrownBy(feedback::markCandidateCreated)
        .isInstanceOf(InvalidSimulationFeedbackException.class)
        .hasMessageContaining("OPEN feedback");
  }

  @Test
  @DisplayName("markResolved: OPEN 또는 후보 생성 피드백을 해결 상태로 전환한다")
  void shouldMarkResolved() {
    SimulationFeedback openFeedback = feedback();
    SimulationFeedback candidateCreatedFeedback = feedback();
    candidateCreatedFeedback.markCandidateCreated();

    openFeedback.markResolved();
    candidateCreatedFeedback.markResolved();

    assertThat(openFeedback.getStatus()).isEqualTo(SimulationFeedbackStatus.RESOLVED);
    assertThat(candidateCreatedFeedback.getStatus()).isEqualTo(SimulationFeedbackStatus.RESOLVED);
  }

  @Test
  @DisplayName("markDismissed: OPEN 또는 후보 생성 피드백을 무시 상태로 전환한다")
  void shouldMarkDismissed() {
    SimulationFeedback openFeedback = feedback();
    SimulationFeedback candidateCreatedFeedback = feedback();
    candidateCreatedFeedback.markCandidateCreated();

    openFeedback.markDismissed();
    candidateCreatedFeedback.markDismissed();

    assertThat(openFeedback.getStatus()).isEqualTo(SimulationFeedbackStatus.DISMISSED);
    assertThat(candidateCreatedFeedback.getStatus()).isEqualTo(SimulationFeedbackStatus.DISMISSED);
  }

  @Test
  @DisplayName("markResolved/markDismissed: 종료된 피드백은 다시 결정할 수 없다")
  void shouldRejectDecisionWhenFeedbackClosed() {
    SimulationFeedback resolved = feedback();
    SimulationFeedback dismissed = feedback();
    resolved.markResolved();
    dismissed.markDismissed();

    assertThatThrownBy(resolved::markDismissed)
        .isInstanceOf(InvalidSimulationFeedbackException.class)
        .hasMessageContaining("dismissed from OPEN or CANDIDATE_CREATED");
    assertThatThrownBy(dismissed::markResolved)
        .isInstanceOf(InvalidSimulationFeedbackException.class)
        .hasMessageContaining("resolved from OPEN or CANDIDATE_CREATED");
  }

  @Test
  @DisplayName("onPersist: 생성/수정 시각과 기본 상태를 채운다")
  void shouldFillLifecycleDefaultsOnPersist() {
    SimulationFeedback feedback = feedback();
    ReflectionTestUtils.setField(feedback, "status", null);

    feedback.onPersist();

    assertThat(feedback.getCreatedAt()).isNotNull();
    assertThat(feedback.getUpdatedAt()).isNotNull();
    assertThat(feedback.getStatus()).isEqualTo(SimulationFeedbackStatus.OPEN);
  }

  @Test
  @DisplayName("onPersist: 이미 있는 생성/수정 시각과 상태는 유지한다")
  void shouldKeepExistingLifecycleValuesOnPersist() {
    SimulationFeedback feedback = feedback();
    OffsetDateTime createdAt = OffsetDateTime.parse("2026-06-04T10:00:00+09:00");
    OffsetDateTime updatedAt = OffsetDateTime.parse("2026-06-04T10:05:00+09:00");
    ReflectionTestUtils.setField(feedback, "createdAt", createdAt);
    ReflectionTestUtils.setField(feedback, "updatedAt", updatedAt);
    ReflectionTestUtils.setField(feedback, "status", SimulationFeedbackStatus.RESOLVED);

    feedback.onPersist();

    assertThat(feedback.getCreatedAt()).isEqualTo(createdAt);
    assertThat(feedback.getUpdatedAt()).isEqualTo(updatedAt);
    assertThat(feedback.getStatus()).isEqualTo(SimulationFeedbackStatus.RESOLVED);
  }

  @Test
  @DisplayName("onUpdate: 수정 시각을 갱신한다")
  void shouldRefreshUpdatedAtOnUpdate() {
    SimulationFeedback feedback = feedback();
    OffsetDateTime updatedAt = OffsetDateTime.parse("2026-06-04T10:05:00+09:00");
    ReflectionTestUtils.setField(feedback, "updatedAt", updatedAt);

    feedback.onUpdate();

    assertThat(feedback.getUpdatedAt()).isAfter(updatedAt);
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("invalidFeedbackArguments")
  @DisplayName("create: 필수 입력이 없거나 본문이 유효하지 않으면 거절한다")
  void shouldRejectInvalidFeedback(String scenario, FeedbackFactory factory, String message) {
    assertThat(scenario).isNotBlank();
    assertThatThrownBy(factory::create)
        .isInstanceOf(InvalidSimulationFeedbackException.class)
        .hasMessageContaining(message);
  }

  private static Stream<Arguments> invalidFeedbackArguments() {
    return Stream.of(
        Arguments.of(
            "workspaceId null",
            (FeedbackFactory) () -> SimulationFeedback.create(null, 55L, null, content(), 7L),
            "workspaceId must not be null"),
        Arguments.of(
            "chatSessionId null",
            (FeedbackFactory) () -> SimulationFeedback.create(10L, null, null, content(), 7L),
            "chatSessionId must not be null"),
        Arguments.of(
            "content null",
            (FeedbackFactory) () -> SimulationFeedback.create(10L, 55L, null, null, 7L),
            "content must not be null"),
        Arguments.of(
            "feedbackType null",
            (FeedbackFactory)
                () ->
                    SimulationFeedback.create(
                        10L,
                        55L,
                        null,
                        new SimulationFeedbackContent(
                            null, "설명", "기대 행동", SimulationFeedbackSeverity.HIGH),
                        7L),
            "feedbackType must not be null"),
        Arguments.of(
            "description blank",
            (FeedbackFactory)
                () ->
                    SimulationFeedback.create(
                        10L,
                        55L,
                        null,
                        new SimulationFeedbackContent(
                            SimulationFeedbackType.OTHER,
                            "  ",
                            "기대 행동",
                            SimulationFeedbackSeverity.HIGH),
                        7L),
            "description must not be blank"),
        Arguments.of(
            "expectedBehavior too long",
            (FeedbackFactory)
                () ->
                    SimulationFeedback.create(
                        10L,
                        55L,
                        null,
                        new SimulationFeedbackContent(
                            SimulationFeedbackType.OTHER,
                            "설명",
                            "a".repeat(2001),
                            SimulationFeedbackSeverity.HIGH),
                        7L),
            "expectedBehavior must be at most 2000"),
        Arguments.of(
            "severity null",
            (FeedbackFactory)
                () ->
                    SimulationFeedback.create(
                        10L,
                        55L,
                        null,
                        new SimulationFeedbackContent(
                            SimulationFeedbackType.OTHER, "설명", "기대 행동", null),
                        7L),
            "severity must not be null"),
        Arguments.of(
            "createdBy null",
            (FeedbackFactory) () -> SimulationFeedback.create(10L, 55L, null, content(), null),
            "createdBy must not be null"));
  }

  private static SimulationFeedbackContent content() {
    return new SimulationFeedbackContent(
        SimulationFeedbackType.OTHER,
        "세션 전체 흐름이 어색합니다.",
        "질문 순서를 조정합니다.",
        SimulationFeedbackSeverity.MEDIUM);
  }

  private static SimulationFeedback feedback() {
    return SimulationFeedback.create(10L, 55L, null, content(), 7L);
  }

  @FunctionalInterface
  private interface FeedbackFactory {
    SimulationFeedback create();
  }
}
