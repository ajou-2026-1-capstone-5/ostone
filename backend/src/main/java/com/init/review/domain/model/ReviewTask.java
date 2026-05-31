package com.init.review.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "review_task", schema = "review")
public class ReviewTask {

  public static final String STATUS_OPEN = "OPEN";
  public static final String STATUS_RESOLVED = "RESOLVED";
  public static final String TARGET_DOMAIN_CANDIDATE = "DOMAIN_CANDIDATE";
  public static final String TARGET_FEEDBACK_PAIR = "FEEDBACK_PAIR";

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "review_session_id", nullable = false, updatable = false)
  private Long reviewSessionId;

  @Column(name = "target_type", nullable = false)
  private String targetType;

  @Column(name = "target_id")
  private Long targetId;

  @Column(name = "target_ref_json", columnDefinition = "jsonb", nullable = false)
  @JdbcTypeCode(SqlTypes.JSON)
  private String targetRefJson;

  @Column(name = "title", nullable = false)
  private String title;

  @Column(name = "status", nullable = false)
  private String status;

  @Column(name = "priority", nullable = false)
  private String priority;

  @Column(name = "proposed_change_json", columnDefinition = "jsonb", nullable = false)
  @JdbcTypeCode(SqlTypes.JSON)
  private String proposedChangeJson;

  @Column(name = "resolved_by")
  private Long resolvedBy;

  @Column(name = "resolved_at")
  private OffsetDateTime resolvedAt;

  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  protected ReviewTask() {}

  public static ReviewTask create(
      Long reviewSessionId,
      String targetType,
      String targetRefJson,
      String title,
      String priority,
      String proposedChangeJson,
      OffsetDateTime now) {
    ReviewTask task = new ReviewTask();
    task.reviewSessionId = reviewSessionId;
    task.targetType = targetType;
    task.targetRefJson = targetRefJson != null ? targetRefJson : "{}";
    task.title = title;
    task.status = STATUS_OPEN;
    task.priority = priority != null ? priority : "NORMAL";
    task.proposedChangeJson = proposedChangeJson != null ? proposedChangeJson : "{}";
    task.createdAt = now;
    task.updatedAt = now;
    return task;
  }

  public void resolve(Long resolvedBy, OffsetDateTime resolvedAt) {
    this.status = STATUS_RESOLVED;
    this.resolvedBy = resolvedBy;
    this.resolvedAt = resolvedAt;
    this.updatedAt = resolvedAt;
  }

  public Long getId() {
    return id;
  }

  public Long getReviewSessionId() {
    return reviewSessionId;
  }

  public String getTargetType() {
    return targetType;
  }

  public String getTargetRefJson() {
    return targetRefJson;
  }

  public String getTitle() {
    return title;
  }

  public String getStatus() {
    return status;
  }

  public String getPriority() {
    return priority;
  }

  public String getProposedChangeJson() {
    return proposedChangeJson;
  }
}
