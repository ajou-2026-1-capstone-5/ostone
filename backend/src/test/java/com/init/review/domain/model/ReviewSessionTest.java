package com.init.review.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("ReviewSession")
class ReviewSessionTest {

  private static final OffsetDateTime OPENED_AT = OffsetDateTime.parse("2026-06-01T01:00:00Z");

  @Test
  @DisplayName("pipeline checkpoint review session을 생성한다")
  void createPipelineCheckpoint_setsOpenSessionFields() {
    ReviewSession session =
        ReviewSession.createPipelineCheckpoint(
            1L,
            7L,
            3L,
            ReviewSession.KIND_DOMAIN_CONFIRMATION,
            "도메인 확인",
            "설명",
            "{\"stage\":\"domain\"}",
            OPENED_AT);

    assertThat(session.getWorkspaceId()).isEqualTo(1L);
    assertThat(session.getPipelineJobId()).isEqualTo(7L);
    assertThat(session.getDatasetId()).isEqualTo(3L);
    assertThat(session.getReviewKind()).isEqualTo(ReviewSession.KIND_DOMAIN_CONFIRMATION);
    assertThat(session.getStatus()).isEqualTo(ReviewSession.STATUS_OPEN);
    assertThat(session.getTitle()).isEqualTo("도메인 확인");
    assertThat(session.getDescription()).isEqualTo("설명");
    assertThat(session.getMetaJson()).contains("domain");
    assertThat(session.getDomainPackVersionId()).isNull();
    assertThat(session.getCreatedBy()).isNull();
    assertThat(session.getOpenedAt()).isEqualTo(OPENED_AT);
    assertThat(session.getClosedAt()).isNull();
  }

  @Test
  @DisplayName("metaJson이 없으면 빈 JSON으로 저장한다")
  void createPipelineCheckpoint_withNullMeta_usesDefaultJson() {
    ReviewSession session =
        ReviewSession.createPipelineCheckpoint(
            1L, 7L, 3L, ReviewSession.KIND_HUMAN_FEEDBACK, "피드백", null, null, OPENED_AT);

    assertThat(session.getReviewKind()).isEqualTo(ReviewSession.KIND_HUMAN_FEEDBACK);
    assertThat(session.getDescription()).isNull();
    assertThat(session.getMetaJson()).isEqualTo("{}");
  }

  @Test
  @DisplayName("domain pack review session을 생성한다")
  void createDomainPackReview_setsOpenSessionFields() {
    ReviewSession session =
        ReviewSession.createDomainPackReview(
            1L,
            11L,
            ReviewSession.KIND_SIMULATION_IMPROVEMENT,
            "시뮬레이션 개선 후보 검토",
            "설명",
            5L,
            null,
            OPENED_AT);

    assertThat(session.getWorkspaceId()).isEqualTo(1L);
    assertThat(session.getDomainPackVersionId()).isEqualTo(11L);
    assertThat(session.getReviewKind()).isEqualTo(ReviewSession.KIND_SIMULATION_IMPROVEMENT);
    assertThat(session.getStatus()).isEqualTo(ReviewSession.STATUS_OPEN);
    assertThat(session.getTitle()).isEqualTo("시뮬레이션 개선 후보 검토");
    assertThat(session.getDescription()).isEqualTo("설명");
    assertThat(session.getMetaJson()).isEqualTo("{}");
    assertThat(session.getCreatedBy()).isEqualTo(5L);
    assertThat(session.getPipelineJobId()).isNull();
    assertThat(session.getDatasetId()).isNull();
    assertThat(session.getOpenedAt()).isEqualTo(OPENED_AT);
  }

  @Test
  @DisplayName("세션을 닫으면 상태와 닫힌 시간을 기록한다")
  void close_marksClosed() {
    ReviewSession session =
        ReviewSession.createPipelineCheckpoint(
            1L, 7L, 3L, ReviewSession.KIND_HUMAN_FEEDBACK, "피드백", "설명", "{}", OPENED_AT);
    OffsetDateTime closedAt = OPENED_AT.plusMinutes(10);

    session.close(closedAt);

    assertThat(session.getStatus()).isEqualTo(ReviewSession.STATUS_CLOSED);
    assertThat(session.getClosedAt()).isEqualTo(closedAt);
  }
}
