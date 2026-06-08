package com.init.pipelinejob.testfixture;

import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;

import com.init.pipelinejob.domain.model.PipelineJob;
import java.time.OffsetDateTime;

public final class PipelineJobFixtures {

  private static final OffsetDateTime DEFAULT_REQUESTED_AT =
      OffsetDateTime.parse("2026-06-01T00:00:00Z");

  private PipelineJobFixtures() {}

  public static PipelineJob persisted(PipelineJob job, Long id) {
    PipelineJob persisted = spy(job);
    lenient().doReturn(id).when(persisted).getId();
    return persisted;
  }

  public static Builder domainPackGeneration(Long id) {
    return new Builder(id, PipelineJob.JOB_TYPE_DOMAIN_PACK_GENERATION);
  }

  public static Builder ingestion(Long id) {
    return new Builder(id, PipelineJob.JOB_TYPE_INGESTION);
  }

  public static PipelineJob cancelledDomainPackGeneration(
      Long id, Long workspaceId, Long datasetId) {
    PipelineJob job = mock(PipelineJob.class);
    lenient().doReturn(id).when(job).getId();
    lenient().doReturn(workspaceId).when(job).getWorkspaceId();
    lenient().doReturn(datasetId).when(job).getDatasetId();
    lenient().doReturn(PipelineJob.JOB_TYPE_DOMAIN_PACK_GENERATION).when(job).getJobType();
    lenient().doReturn(PipelineJob.STATUS_CANCELLED).when(job).getStatus();
    lenient().doReturn("domain_pack_generation").when(job).getAirflowDagId();
    lenient().doReturn("pipeline_job_" + id).when(job).getAirflowRunId();
    lenient().doReturn(true).when(job).isCancelled();
    lenient().doReturn(true).when(job).isFinalized();
    return job;
  }

  public static final class Builder {

    private final Long id;
    private final String jobType;
    private Long workspaceId = 1L;
    private Long datasetId = 7L;
    private Long triggeredBy = 9L;
    private Long domainPackId = 7L;
    private Long retriedFromJobId;
    private String status = PipelineJob.STATUS_RUNNING;
    private String requestPayloadJson = "{}";
    private String resultSummaryJson = "{}";
    private String airflowDagId = "domain_pack_generation";
    private String airflowRunId;
    private OffsetDateTime requestedAt = DEFAULT_REQUESTED_AT;
    private OffsetDateTime startedAt;
    private OffsetDateTime finishedAt;

    private Builder(Long id, String jobType) {
      this.id = id;
      this.jobType = jobType;
      this.airflowRunId = "pipeline_job_" + id;
    }

    public Builder workspaceId(Long workspaceId) {
      this.workspaceId = workspaceId;
      return this;
    }

    public Builder datasetId(Long datasetId) {
      this.datasetId = datasetId;
      return this;
    }

    public Builder triggeredBy(Long triggeredBy) {
      this.triggeredBy = triggeredBy;
      return this;
    }

    public Builder domainPackId(Long domainPackId) {
      this.domainPackId = domainPackId;
      return this;
    }

    public Builder retriedFromJobId(Long retriedFromJobId) {
      this.retriedFromJobId = retriedFromJobId;
      return this;
    }

    public Builder status(String status) {
      this.status = status;
      return this;
    }

    public Builder requestPayloadJson(String requestPayloadJson) {
      this.requestPayloadJson = requestPayloadJson;
      return this;
    }

    public Builder resultSummaryJson(String resultSummaryJson) {
      this.resultSummaryJson = resultSummaryJson;
      return this;
    }

    public Builder airflowRun(String airflowDagId, String airflowRunId) {
      this.airflowDagId = airflowDagId;
      this.airflowRunId = airflowRunId;
      return this;
    }

    public Builder requestedAt(OffsetDateTime requestedAt) {
      this.requestedAt = requestedAt;
      return this;
    }

    public Builder startedAt(OffsetDateTime startedAt) {
      this.startedAt = startedAt;
      return this;
    }

    public Builder finishedAt(OffsetDateTime finishedAt) {
      this.finishedAt = finishedAt;
      return this;
    }

    public PipelineJob build() {
      PipelineJob job =
          PipelineJob.JOB_TYPE_INGESTION.equals(jobType)
              ? PipelineJob.createIngestion(workspaceId, datasetId, requestedAt)
              : PipelineJob.createDomainPackGeneration(
                  workspaceId,
                  datasetId,
                  triggeredBy,
                  requestPayloadJson,
                  requestedAt,
                  retriedFromJobId);
      applyStatus(job);
      return persisted(job, id);
    }

    private void applyStatus(PipelineJob job) {
      if (PipelineJob.STATUS_QUEUED.equals(status)) {
        return;
      }
      OffsetDateTime startTime = startedAt != null ? startedAt : requestedAt.plusMinutes(1);
      job.assignAirflowRun(airflowDagId, airflowRunId, requestPayloadJson);
      job.markAirflowTriggered(startTime);
      switch (status) {
        case PipelineJob.STATUS_RUNNING -> {
          if (!"{}".equals(resultSummaryJson)) {
            job.markRunning(resultSummaryJson);
          }
        }
        case PipelineJob.STATUS_WAITING_DOMAIN_CONFIRMATION ->
            job.markAwaitingDomainConfirmation(resultSummaryJson);
        case PipelineJob.STATUS_WAITING_HUMAN_FEEDBACK ->
            job.markAwaitingHumanFeedback(resultSummaryJson);
        case PipelineJob.STATUS_WAITING_INTENT_CALLBACK ->
            job.markAwaitingIntentCallback(domainPackId, resultSummaryJson);
        case PipelineJob.STATUS_WAITING_WORKFLOW_CALLBACK ->
            job.markAwaitingWorkflowCallback(domainPackId, resultSummaryJson);
        case PipelineJob.STATUS_SUCCEEDED ->
            job.markSucceeded(
                domainPackId,
                resultSummaryJson,
                finishedAt != null ? finishedAt : startTime.plusMinutes(1));
        case PipelineJob.STATUS_FAILED ->
            job.markFailed(
                "fixture failure", finishedAt != null ? finishedAt : startTime.plusMinutes(1));
        default -> throw new IllegalArgumentException("Unsupported PipelineJob status: " + status);
      }
    }
  }
}
