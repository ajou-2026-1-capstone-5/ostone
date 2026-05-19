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

  public static final String JOB_TYPE_DOMAIN_PACK_GENERATION = "DOMAIN_PACK_GENERATION";
  public static final String JOB_TYPE_INGESTION = "INGESTION";

  public static final String STATUS_QUEUED = "QUEUED";
  public static final String STATUS_RUNNING = "RUNNING";
  public static final String STATUS_WAITING_INTENT_CALLBACK = "WAITING_INTENT_CALLBACK";
  public static final String STATUS_WAITING_WORKFLOW_CALLBACK = "WAITING_WORKFLOW_CALLBACK";
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
      String requestPayloadJson,
      OffsetDateTime requestedAt) {
    Objects.requireNonNull(workspaceId, "workspaceId must not be null");
    Objects.requireNonNull(jobType, "jobType must not be null");
    Objects.requireNonNull(status, "status must not be null");
    Objects.requireNonNull(triggerSource, "triggerSource must not be null");
    Objects.requireNonNull(requestedAt, "requestedAt must not be null");

    PipelineJob pipelineJob = new PipelineJob();
    pipelineJob.workspaceId = workspaceId;
    pipelineJob.jobType = jobType;
    pipelineJob.status = status;
    pipelineJob.triggerSource = triggerSource;
    pipelineJob.requestPayloadJson = requestPayloadJson != null ? requestPayloadJson : "{}";
    pipelineJob.resultSummaryJson = "{}";
    pipelineJob.requestedAt = requestedAt;
    return pipelineJob;
  }

  public static PipelineJob createDomainPackGeneration(
      Long workspaceId,
      Long datasetId,
      Long triggeredBy,
      String requestPayloadJson,
      OffsetDateTime requestedAt) {
    Objects.requireNonNull(datasetId, "datasetId must not be null");
    PipelineJob pipelineJob =
        create(
            workspaceId,
            JOB_TYPE_DOMAIN_PACK_GENERATION,
            STATUS_QUEUED,
            "MANUAL",
            requestPayloadJson,
            requestedAt);
    pipelineJob.datasetId = datasetId;
    pipelineJob.triggeredBy = triggeredBy;
    return pipelineJob;
  }

  public static PipelineJob createIngestion(
      Long workspaceId, Long datasetId, OffsetDateTime requestedAt) {
    Objects.requireNonNull(datasetId, "datasetId must not be null");
    PipelineJob job =
        create(workspaceId, JOB_TYPE_INGESTION, STATUS_QUEUED, "AUTO", "{}", requestedAt);
    job.datasetId = datasetId;
    return job;
  }

  public boolean canAcceptDomainPackDraftCallback() {
    return STATUS_QUEUED.equals(status) || STATUS_RUNNING.equals(status);
  }

  public boolean canAcceptIntentDraftCallback() {
    return STATUS_WAITING_INTENT_CALLBACK.equals(status);
  }

  public boolean canAcceptWorkflowDraftCallback() {
    return STATUS_WAITING_WORKFLOW_CALLBACK.equals(status) || STATUS_RUNNING.equals(status);
  }

  public boolean isFinalized() {
    return STATUS_SUCCEEDED.equals(status)
        || STATUS_FAILED.equals(status)
        || STATUS_CANCELLED.equals(status);
  }

  public boolean isFailed() {
    return STATUS_FAILED.equals(status);
  }

  public boolean isCancelled() {
    return STATUS_CANCELLED.equals(status);
  }

  public boolean isSucceeded() {
    return STATUS_SUCCEEDED.equals(status);
  }

  public void assignAirflowRun(
      String airflowDagId, String airflowRunId, String requestPayloadJson) {
    Objects.requireNonNull(airflowDagId, "airflowDagId must not be null");
    Objects.requireNonNull(airflowRunId, "airflowRunId must not be null");
    if (!STATUS_QUEUED.equals(status)) {
      throw new IllegalStateException("Airflow run은 QUEUED 상태에서만 할당할 수 있습니다.");
    }
    this.airflowDagId = airflowDagId;
    this.airflowRunId = airflowRunId;
    this.requestPayloadJson = requestPayloadJson != null ? requestPayloadJson : "{}";
  }

  public void markAirflowTriggered(OffsetDateTime startedAt) {
    Objects.requireNonNull(startedAt, "startedAt must not be null");
    if (!STATUS_QUEUED.equals(status)) {
      throw new IllegalStateException("Airflow trigger 성공은 QUEUED 상태에서만 반영할 수 있습니다.");
    }
    if (airflowDagId == null || airflowRunId == null) {
      throw new IllegalStateException("Airflow trigger 성공 반영 전에 assignAirflowRun을 호출해야 합니다.");
    }
    this.status = STATUS_RUNNING;
    this.startedAt = startedAt;
    this.finishedAt = null;
    this.lastErrorMessage = null;
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

  public void markRunning(String resultSummaryJson) {
    if (isFinalized()) {
      throw new IllegalStateException("종료된 job은 RUNNING 상태로 전환할 수 없습니다.");
    }
    this.resultSummaryJson = resultSummaryJson != null ? resultSummaryJson : "{}";
    this.status = STATUS_RUNNING;
    this.finishedAt = null;
    this.lastErrorMessage = null;
  }

  public void markAwaitingIntentCallback(Long domainPackId, String resultSummaryJson) {
    this.domainPackId = domainPackId;
    this.resultSummaryJson = resultSummaryJson != null ? resultSummaryJson : "{}";
    this.status = STATUS_WAITING_INTENT_CALLBACK;
    this.lastErrorMessage = null;
  }

  public void markAwaitingWorkflowCallback(Long domainPackId, String resultSummaryJson) {
    this.domainPackId = domainPackId;
    this.resultSummaryJson = resultSummaryJson != null ? resultSummaryJson : "{}";
    this.status = STATUS_WAITING_WORKFLOW_CALLBACK;
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

  public Long getDatasetId() {
    return datasetId;
  }

  public Long getDomainPackId() {
    return domainPackId;
  }

  public String getJobType() {
    return jobType;
  }

  public String getStatus() {
    return status;
  }

  public String getAirflowDagId() {
    return airflowDagId;
  }

  public String getAirflowRunId() {
    return airflowRunId;
  }

  public String getRequestPayloadJson() {
    return requestPayloadJson;
  }

  public String getResultSummaryJson() {
    return resultSummaryJson;
  }

  public Long getTriggeredBy() {
    return triggeredBy;
  }

  public OffsetDateTime getRequestedAt() {
    return requestedAt;
  }

  public OffsetDateTime getStartedAt() {
    return startedAt;
  }

  public OffsetDateTime getFinishedAt() {
    return finishedAt;
  }

  public String getLastErrorMessage() {
    return lastErrorMessage;
  }
}
