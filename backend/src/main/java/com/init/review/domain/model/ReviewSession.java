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
@Table(name = "review_session", schema = "review")
public class ReviewSession {

  public static final String STATUS_OPEN = "OPEN";
  public static final String STATUS_CLOSED = "CLOSED";
  public static final String KIND_DOMAIN_CONFIRMATION = "DOMAIN_CONFIRMATION";
  public static final String KIND_HUMAN_FEEDBACK = "HUMAN_FEEDBACK";
  public static final String KIND_SIMULATION_IMPROVEMENT = "SIMULATION_IMPROVEMENT";

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "workspace_id", nullable = false, updatable = false)
  private Long workspaceId;

  @Column(name = "domain_pack_version_id")
  private Long domainPackVersionId;

  @Column(name = "pipeline_job_id")
  private Long pipelineJobId;

  @Column(name = "dataset_id")
  private Long datasetId;

  @Column(name = "review_kind", nullable = false)
  private String reviewKind;

  @Column(name = "status", nullable = false)
  private String status;

  @Column(name = "title", nullable = false)
  private String title;

  @Column(name = "description")
  private String description;

  @Column(name = "created_by")
  private Long createdBy;

  @Column(name = "opened_at", nullable = false, updatable = false)
  private OffsetDateTime openedAt;

  @Column(name = "closed_at")
  private OffsetDateTime closedAt;

  @Column(name = "meta_json", columnDefinition = "jsonb", nullable = false)
  @JdbcTypeCode(SqlTypes.JSON)
  private String metaJson;

  protected ReviewSession() {}

  public static ReviewSession createPipelineCheckpoint(
      Long workspaceId,
      Long pipelineJobId,
      Long datasetId,
      String reviewKind,
      String title,
      String description,
      String metaJson,
      OffsetDateTime openedAt) {
    ReviewSession session = new ReviewSession();
    session.workspaceId = workspaceId;
    session.pipelineJobId = pipelineJobId;
    session.datasetId = datasetId;
    session.reviewKind = reviewKind;
    session.status = STATUS_OPEN;
    session.title = title;
    session.description = description;
    session.metaJson = metaJson != null ? metaJson : "{}";
    session.openedAt = openedAt;
    return session;
  }

  public static ReviewSession createDomainPackReview(
      Long workspaceId,
      Long domainPackVersionId,
      String reviewKind,
      String title,
      String description,
      Long createdBy,
      String metaJson,
      OffsetDateTime openedAt) {
    ReviewSession session = new ReviewSession();
    session.workspaceId = workspaceId;
    session.domainPackVersionId = domainPackVersionId;
    session.reviewKind = reviewKind;
    session.status = STATUS_OPEN;
    session.title = title;
    session.description = description;
    session.createdBy = createdBy;
    session.metaJson = metaJson != null ? metaJson : "{}";
    session.openedAt = openedAt;
    return session;
  }

  public void close(OffsetDateTime closedAt) {
    this.status = STATUS_CLOSED;
    this.closedAt = closedAt;
  }

  public Long getId() {
    return id;
  }

  public Long getWorkspaceId() {
    return workspaceId;
  }

  public Long getPipelineJobId() {
    return pipelineJobId;
  }

  public Long getDomainPackVersionId() {
    return domainPackVersionId;
  }

  public Long getDatasetId() {
    return datasetId;
  }

  public String getReviewKind() {
    return reviewKind;
  }

  public String getStatus() {
    return status;
  }

  public String getTitle() {
    return title;
  }

  public String getDescription() {
    return description;
  }

  public Long getCreatedBy() {
    return createdBy;
  }

  public OffsetDateTime getOpenedAt() {
    return openedAt;
  }

  public OffsetDateTime getClosedAt() {
    return closedAt;
  }

  public String getMetaJson() {
    return metaJson;
  }
}
