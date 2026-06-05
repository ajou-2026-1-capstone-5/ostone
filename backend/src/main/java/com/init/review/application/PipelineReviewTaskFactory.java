package com.init.review.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.init.review.domain.model.ReviewSession;
import com.init.review.domain.model.ReviewTask;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class PipelineReviewTaskFactory {

  private final PipelineReviewCheckpointJsonSupport jsonSupport;

  public PipelineReviewTaskFactory(PipelineReviewCheckpointJsonSupport jsonSupport) {
    this.jsonSupport = jsonSupport;
  }

  public List<ReviewTask> createTasks(
      Long sessionId, String reviewKind, JsonNode artifactPayload, OffsetDateTime now) {
    List<ReviewTask> tasks = new ArrayList<>();
    JsonNode rows = artifactPayload.path(arrayName(reviewKind));
    if (!rows.isArray()) {
      return tasks;
    }
    for (JsonNode row : rows) {
      String title = title(row, reviewKind);
      tasks.add(
          ReviewTask.create(
              sessionId,
              targetType(reviewKind),
              jsonSupport.toJson(row),
              title.isBlank() ? titleFor(reviewKind) : title,
              priority(row),
              "{}",
              now));
    }
    return tasks;
  }

  private String arrayName(String reviewKind) {
    return ReviewSession.KIND_DOMAIN_CONFIRMATION.equals(reviewKind) ? "candidates" : "questions";
  }

  private String targetType(String reviewKind) {
    return ReviewSession.KIND_DOMAIN_CONFIRMATION.equals(reviewKind)
        ? ReviewTask.TARGET_DOMAIN_CANDIDATE
        : ReviewTask.TARGET_FEEDBACK_PAIR;
  }

  private String title(JsonNode row, String reviewKind) {
    return ReviewSession.KIND_DOMAIN_CONFIRMATION.equals(reviewKind)
        ? jsonSupport.text(row, "displayName")
        : jsonSupport.text(row, "questionText");
  }

  private String priority(JsonNode row) {
    String priority = jsonSupport.text(row, "priority");
    return priority.isBlank() ? "NORMAL" : priority;
  }

  private String titleFor(String reviewKind) {
    return ReviewSession.KIND_DOMAIN_CONFIRMATION.equals(reviewKind) ? "상담 도메인 확정" : "클러스터링 피드백";
  }
}
