package com.init.review.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.review.domain.model.ReviewSession;
import com.init.review.domain.model.ReviewTask;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("PipelineReviewTaskFactory")
class PipelineReviewTaskFactoryTest {

  private static final OffsetDateTime NOW = OffsetDateTime.parse("2026-06-01T01:00:00Z");

  private final ObjectMapper objectMapper = new ObjectMapper();
  private final PipelineReviewTaskFactory taskFactory =
      new PipelineReviewTaskFactory(new PipelineReviewCheckpointJsonSupport(objectMapper));

  @Test
  @DisplayName("domain confirmation payload를 domain candidate review task로 변환한다")
  void createTasks_domainConfirmation_createsCandidateTasks() throws Exception {
    JsonNode payload =
        objectMapper.readTree(
            """
            {
              "candidates": [
                {"candidateId": "card", "displayName": "카드 상담", "priority": "HIGH"},
                {"candidateId": "misc"}
              ]
            }
            """);

    List<ReviewTask> tasks =
        taskFactory.createTasks(55L, ReviewSession.KIND_DOMAIN_CONFIRMATION, payload, NOW);

    assertThat(tasks).hasSize(2);
    assertThat(tasks.getFirst().getReviewSessionId()).isEqualTo(55L);
    assertThat(tasks.getFirst().getTargetType()).isEqualTo(ReviewTask.TARGET_DOMAIN_CANDIDATE);
    assertThat(tasks.getFirst().getTitle()).isEqualTo("카드 상담");
    assertThat(tasks.getFirst().getPriority()).isEqualTo("HIGH");
    assertThat(tasks.get(1).getTitle()).isEqualTo("상담 도메인 확정");
    assertThat(tasks.get(1).getPriority()).isEqualTo("NORMAL");
  }

  @Test
  @DisplayName("human feedback payload를 feedback pair review task로 변환한다")
  void createTasks_humanFeedback_createsFeedbackTasks() throws Exception {
    JsonNode payload =
        objectMapper.readTree(
            """
            {
              "questions": [
                {"sourceId": "c1", "targetId": "c2", "questionText": "같은 업무인가?"}
              ]
            }
            """);

    List<ReviewTask> tasks =
        taskFactory.createTasks(56L, ReviewSession.KIND_HUMAN_FEEDBACK, payload, NOW);

    assertThat(tasks).hasSize(1);
    assertThat(tasks.getFirst().getTargetType()).isEqualTo(ReviewTask.TARGET_FEEDBACK_PAIR);
    assertThat(tasks.getFirst().getTitle()).isEqualTo("같은 업무인가?");
    assertThat(tasks.getFirst().getTargetRefJson()).contains("\"sourceId\":\"c1\"");
  }
}
