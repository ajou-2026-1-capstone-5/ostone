package com.init.review.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("ReviewTask")
class ReviewTaskTest {

  private static final OffsetDateTime NOW = OffsetDateTime.parse("2026-06-01T01:00:00Z");

  @Test
  @DisplayName("targetId가 있는 review task를 생성한다")
  void createWithTargetId_setsOpenTaskFields() {
    ReviewTask task =
        ReviewTask.create(
            10L,
            ReviewTask.TARGET_SIMULATION_IMPROVEMENT_CANDIDATE,
            1000L,
            "{}",
            "개선 후보",
            "NORMAL",
            "{\"operation\":\"UPDATE_DESCRIPTION\"}",
            NOW);

    assertThat(task.getReviewSessionId()).isEqualTo(10L);
    assertThat(task.getTargetType()).isEqualTo(ReviewTask.TARGET_SIMULATION_IMPROVEMENT_CANDIDATE);
    assertThat(task.getTargetId()).isEqualTo(1000L);
    assertThat(task.getTargetRefJson()).isEqualTo("{}");
    assertThat(task.getTitle()).isEqualTo("개선 후보");
    assertThat(task.getStatus()).isEqualTo(ReviewTask.STATUS_OPEN);
    assertThat(task.getPriority()).isEqualTo("NORMAL");
    assertThat(task.getProposedChangeJson()).contains("UPDATE_DESCRIPTION");
  }

  @Test
  @DisplayName("resolve: 열린 task를 완료 상태로 전환한다")
  void resolve_marksTaskResolved() {
    ReviewTask task =
        ReviewTask.create(
            10L, ReviewTask.TARGET_DOMAIN_CANDIDATE, "{}", "도메인 후보", "NORMAL", "{}", NOW);

    task.resolve(7L, NOW.plusMinutes(3));

    assertThat(task.getStatus()).isEqualTo(ReviewTask.STATUS_RESOLVED);
  }

  @Test
  @DisplayName("resolve: 이미 완료된 task는 다시 완료할 수 없다")
  void resolve_rejectsAlreadyResolvedTask() {
    ReviewTask task =
        ReviewTask.create(
            10L, ReviewTask.TARGET_DOMAIN_CANDIDATE, "{}", "도메인 후보", "NORMAL", "{}", NOW);
    task.resolve(7L, NOW.plusMinutes(3));

    assertThatThrownBy(() -> task.resolve(7L, NOW.plusMinutes(4)))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("이미 resolve");
  }
}
