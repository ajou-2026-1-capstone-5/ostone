package com.init.workflowruntime.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

@DisplayName("SimulationImprovementCandidate")
class SimulationImprovementCandidateTest {

  @Test
  @DisplayName("create: 후보 본문을 정규화하고 DRAFT 상태로 생성한다")
  void shouldCreateCandidateWithNormalizedContent() {
    SimulationImprovementCandidate candidate =
        SimulationImprovementCandidate.create(
            10L,
            101L,
            900L,
            55L,
            2L,
            new SimulationImprovementCandidateDraft(
                SimulationImprovementCandidateType.SLOT_QUESTION,
                SimulationImprovementCandidateTargetType.SLOT,
                300L,
                "  order_number  ",
                "  주문번호 질문이 없습니다.  ",
                "  주문번호를 먼저 요청합니다.  ",
                "  feedback #900  "),
            7L);

    assertThat(candidate.getWorkspaceId()).isEqualTo(10L);
    assertThat(candidate.getDomainPackVersionId()).isEqualTo(101L);
    assertThat(candidate.getFeedbackId()).isEqualTo(900L);
    assertThat(candidate.getChatSessionId()).isEqualTo(55L);
    assertThat(candidate.getChatMessageId()).isEqualTo(2L);
    assertThat(candidate.getCandidateType())
        .isEqualTo(SimulationImprovementCandidateType.SLOT_QUESTION);
    assertThat(candidate.getTargetElementType())
        .isEqualTo(SimulationImprovementCandidateTargetType.SLOT);
    assertThat(candidate.getTargetElementId()).isEqualTo(300L);
    assertThat(candidate.getTargetElementKey()).isEqualTo("order_number");
    assertThat(candidate.getBeforeSummary()).isEqualTo("주문번호 질문이 없습니다.");
    assertThat(candidate.getAfterSummary()).isEqualTo("주문번호를 먼저 요청합니다.");
    assertThat(candidate.getEvidenceSummary()).isEqualTo("feedback #900");
    assertThat(candidate.getStatus()).isEqualTo(SimulationImprovementCandidateStatus.DRAFT);
    assertThat(candidate.getCreatedBy()).isEqualTo(7L);
  }

  @Test
  @DisplayName("changeStatus: 후보 상태를 변경한다")
  void shouldChangeStatus() {
    SimulationImprovementCandidate candidate = candidate();

    candidate.changeStatus(SimulationImprovementCandidateStatus.READY_FOR_REVIEW);

    assertThat(candidate.getStatus())
        .isEqualTo(SimulationImprovementCandidateStatus.READY_FOR_REVIEW);
  }

  @Test
  @DisplayName("onPersist: 생성/수정 시각과 기본 상태를 채운다")
  void shouldFillLifecycleDefaultsOnPersist() {
    SimulationImprovementCandidate candidate = candidate();
    ReflectionTestUtils.setField(candidate, "status", null);

    candidate.onPersist();

    assertThat(candidate.getCreatedAt()).isNotNull();
    assertThat(candidate.getUpdatedAt()).isNotNull();
    assertThat(candidate.getStatus()).isEqualTo(SimulationImprovementCandidateStatus.DRAFT);
  }

  @Test
  @DisplayName("onPersist: 이미 있는 생성/수정 시각과 상태는 유지한다")
  void shouldKeepExistingLifecycleValuesOnPersist() {
    SimulationImprovementCandidate candidate = candidate();
    OffsetDateTime createdAt = OffsetDateTime.parse("2026-06-04T10:00:00+09:00");
    OffsetDateTime updatedAt = OffsetDateTime.parse("2026-06-04T10:05:00+09:00");
    ReflectionTestUtils.setField(candidate, "createdAt", createdAt);
    ReflectionTestUtils.setField(candidate, "updatedAt", updatedAt);
    ReflectionTestUtils.setField(
        candidate, "status", SimulationImprovementCandidateStatus.REJECTED);

    candidate.onPersist();

    assertThat(candidate.getCreatedAt()).isEqualTo(createdAt);
    assertThat(candidate.getUpdatedAt()).isEqualTo(updatedAt);
    assertThat(candidate.getStatus()).isEqualTo(SimulationImprovementCandidateStatus.REJECTED);
  }

  @Test
  @DisplayName("onUpdate: 수정 시각을 갱신한다")
  void shouldRefreshUpdatedAtOnUpdate() {
    SimulationImprovementCandidate candidate = candidate();
    OffsetDateTime updatedAt = OffsetDateTime.parse("2026-06-04T10:05:00+09:00");
    ReflectionTestUtils.setField(candidate, "updatedAt", updatedAt);

    candidate.onUpdate();

    assertThat(candidate.getUpdatedAt()).isAfter(updatedAt);
  }

  @Test
  @DisplayName("create: 필수 요약이 비어 있으면 거절한다")
  void shouldRejectBlankSummary() {
    assertThatThrownBy(
            () ->
                SimulationImprovementCandidate.create(
                    10L,
                    101L,
                    900L,
                    55L,
                    null,
                    new SimulationImprovementCandidateDraft(
                        SimulationImprovementCandidateType.OTHER,
                        SimulationImprovementCandidateTargetType.UNKNOWN,
                        null,
                        null,
                        " ",
                        "개선합니다.",
                        "feedback #900"),
                    7L))
        .isInstanceOf(InvalidSimulationImprovementCandidateException.class)
        .hasMessageContaining("beforeSummary must not be blank");
  }

  private static SimulationImprovementCandidate candidate() {
    return SimulationImprovementCandidate.create(
        10L,
        101L,
        900L,
        55L,
        null,
        new SimulationImprovementCandidateDraft(
            SimulationImprovementCandidateType.OTHER,
            SimulationImprovementCandidateTargetType.UNKNOWN,
            null,
            null,
            "현재 문제",
            "개선 방향",
            "feedback #900"),
        7L);
  }
}
