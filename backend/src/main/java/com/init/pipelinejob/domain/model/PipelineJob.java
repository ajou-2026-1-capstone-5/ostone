package com.init.pipelinejob.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.OffsetDateTime;
import java.util.Objects;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "pipeline_job", schema = "pipeline")
public class PipelineJob {

  public static final String STATUS_QUEUED = "QUEUED";
  public static final String STATUS_RUNNING = "RUNNING";
  public static final String STATUS_WAITING_INTENT_CALLBACK = "WAITING_INTENT_CALLBACK";
  public static final String STATUS_SUCCEEDED = "SUCCEEDED";
  public static final String STATUS_FAILED = "FAILED";
  public static final String STATUS_CANCELLED = "CANCELLED";

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Version
  @Column(name = "version", nullable = false)
  private Long version;

  @Column(name = "workspace_id", nullable = false, updatable = false)
  private Long workspaceId;

  @Column(name = "dataset_id")
  private Long datasetId;

  @Column(name = "domain_pack_id")
  private Long domainPackId;

  @Column(name = "job_type", nullable = false)
  private String jobType;

  @Column(name = "status", nullable = false)
  private String status;

  @Column(name = "trigger_source", nullable = false)
  private String triggerSource;

  @Column(name = "airflow_dag_id")
  private String airflowDagId;

  @Column(name = "airflow_run_id")
  private String airflowRunId;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "request_payload_json", columnDefinition = "jsonb", nullable = false)
  private String requestPayloadJson;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "result_summary_json", columnDefinition = "jsonb", nullable = false)
  private String resultSummaryJson;

  @Column(name = "triggered_by")
  private Long triggeredBy;

  @Column(name = "requested_at", nullable = false, updatable = false)
  private OffsetDateTime requestedAt;

  @Column(name = "started_at")
  private OffsetDateTime startedAt;

  @Column(name = "finished_at")
  private OffsetDateTime finishedAt;

  @Column(name = "last_error_message")
  private String lastErrorMessage;

  protected PipelineJob() {}

  public static PipelineJob create(
      Long workspaceId,
      String jobType,
      String status,
      String triggerSource,
      String requestPayloadJson) {
    Objects.requireNonNull(workspaceId, "workspaceId must not be null");
    Objects.requireNonNull(jobType, "jobType must not be null");
    Objects.requireNonNull(status, "status must not be null");
    Objects.requireNonNull(triggerSource, "triggerSource must not be null");

    PipelineJob pipelineJob = new PipelineJob();
    pipelineJob.workspaceId = workspaceId;
    pipelineJob.jobType = jobType;
    pipelineJob.status = status;
    pipelineJob.triggerSource = triggerSource;
    pipelineJob.requestPayloadJson = requestPayloadJson != null ? requestPayloadJson : "{}";
    pipelineJob.resultSummaryJson = "{}";
    pipelineJob.requestedAt = OffsetDateTime.now();
    return pipelineJob;
  }

  public boolean canAcceptDomainPackDraftCallback() {
    return STATUS_QUEUED.equals(status) || STATUS_RUNNING.equals(status);
  }

  public boolean canAcceptIntentDraftCallback() {
    return STATUS_WAITING_INTENT_CALLBACK.equals(status);
  }

  public boolean isFinalized() {
    return STATUS_SUCCEEDED.equals(status)
        || STATUS_FAILED.equals(status)
        || STATUS_CANCELLED.equals(status);
  }

  public void markSucceeded(
      Long domainPackId, String resultSummaryJson, OffsetDateTime finishedAt) {
    Objects.requireNonNull(finishedAt, "finishedAt must not be null");
    this.domainPackId = domainPackId;
    this.resultSummaryJson = resultSummaryJson != null ? resultSummaryJson : "{}";
    this.status = STATUS_SUCCEEDED;
    this.finishedAt = finishedAt;
    this.lastErrorMessage = null;
  }

  public void markAwaitingIntentCallback(Long domainPackId, String resultSummaryJson) {
    this.domainPackId = domainPackId;
    this.resultSummaryJson = resultSummaryJson != null ? resultSummaryJson : "{}";
    this.status = STATUS_WAITING_INTENT_CALLBACK;
    this.lastErrorMessage = null;
  }

  public void markFailed(String lastErrorMessage, OffsetDateTime finishedAt) {
    this.status = STATUS_FAILED;
    this.finishedAt = finishedAt;
    this.lastErrorMessage = lastErrorMessage;
  }

  public Long getId() {
    return id;
  }

  public Long getWorkspaceId() {
    return workspaceId;
  }

  public Long getDomainPackId() {
    return domainPackId;
  }

  public String getStatus() {
    return status;
  }

  public String getResultSummaryJson() {
    return resultSummaryJson;
  }

  public OffsetDateTime getFinishedAt() {
    return finishedAt;
  }

  public String getLastErrorMessage() {
    return lastErrorMessage;
  }
}
