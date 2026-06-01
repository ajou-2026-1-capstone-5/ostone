package com.init.pipelinejob.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("PipelineJob")
class PipelineJobTest {

  private static final OffsetDateTime NOW = OffsetDateTime.parse("2026-05-04T10:00:00Z");

  @Test
  @DisplayName("Airflow run 할당 전에는 RUNNING으로 전환할 수 없다")
  void markAirflowTriggered_withoutAssignedAirflowRun_throws() {
    PipelineJob job = PipelineJob.createDomainPackGeneration(1L, 7L, 55L, "{}", NOW);

    assertThatThrownBy(() -> job.markAirflowTriggered(NOW))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("assignAirflowRun");
  }

  @Test
  @DisplayName("필수 생성 인자가 없으면 job을 만들 수 없다")
  void create_missingRequiredValues_throws() {
    assertThatThrownBy(() -> PipelineJob.create(null, "TYPE", "QUEUED", "MANUAL", "{}", NOW))
        .isInstanceOf(NullPointerException.class)
        .hasMessageContaining("workspaceId");
    assertThatThrownBy(() -> PipelineJob.create(1L, null, "QUEUED", "MANUAL", "{}", NOW))
        .isInstanceOf(NullPointerException.class)
        .hasMessageContaining("jobType");
    assertThatThrownBy(() -> PipelineJob.create(1L, "TYPE", null, "MANUAL", "{}", NOW))
        .isInstanceOf(NullPointerException.class)
        .hasMessageContaining("status");
    assertThatThrownBy(() -> PipelineJob.create(1L, "TYPE", "QUEUED", null, "{}", NOW))
        .isInstanceOf(NullPointerException.class)
        .hasMessageContaining("triggerSource");
    assertThatThrownBy(() -> PipelineJob.create(1L, "TYPE", "QUEUED", "MANUAL", "{}", null))
        .isInstanceOf(NullPointerException.class)
        .hasMessageContaining("requestedAt");
    assertThatThrownBy(() -> PipelineJob.createDomainPackGeneration(1L, null, 55L, "{}", NOW))
        .isInstanceOf(NullPointerException.class)
        .hasMessageContaining("datasetId");
    assertThatThrownBy(() -> PipelineJob.createIngestion(1L, null, NOW))
        .isInstanceOf(NullPointerException.class)
        .hasMessageContaining("datasetId");
  }

  @Test
  @DisplayName("기본 생성 시 null payload는 빈 JSON으로 저장된다")
  void create_withNullPayload_usesDefaultSummary() {
    PipelineJob job = PipelineJob.create(1L, "CUSTOM", "QUEUED", "MANUAL", null, NOW);

    assertThat(job.getWorkspaceId()).isEqualTo(1L);
    assertThat(job.getJobType()).isEqualTo("CUSTOM");
    assertThat(job.getStatus()).isEqualTo(PipelineJob.STATUS_QUEUED);
    assertThat(job.getRequestPayloadJson()).isEqualTo("{}");
    assertThat(job.getResultSummaryJson()).isEqualTo("{}");
    assertThat(job.getRequestedAt()).isEqualTo(NOW);
  }

  @Test
  @DisplayName("ingestion job은 AUTO trigger와 dataset을 가진다")
  void createIngestion_setsIngestionDefaults() {
    PipelineJob job = PipelineJob.createIngestion(1L, 7L, NOW);

    assertThat(job.getJobType()).isEqualTo(PipelineJob.JOB_TYPE_INGESTION);
    assertThat(job.getDatasetId()).isEqualTo(7L);
    assertThat(job.getTriggeredBy()).isNull();
    assertThat(job.getRequestPayloadJson()).isEqualTo("{}");
  }

  @Test
  @DisplayName("QUEUED가 아니면 Airflow run을 할당할 수 없다")
  void assignAirflowRun_notQueued_throws() {
    PipelineJob job = PipelineJob.createDomainPackGeneration(1L, 7L, 55L, "{}", NOW);
    job.assignAirflowRun("domain_pack_generation", "pipeline_job_123", null);
    job.markAirflowTriggered(NOW);

    assertThatThrownBy(
            () -> job.assignAirflowRun("domain_pack_generation", "pipeline_job_456", "{}"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("QUEUED");
    assertThat(job.getRequestPayloadJson()).isEqualTo("{}");
  }

  @Test
  @DisplayName("Airflow run 할당은 필수 값을 요구한다")
  void assignAirflowRun_missingValues_throws() {
    PipelineJob job = PipelineJob.createDomainPackGeneration(1L, 7L, 55L, "{}", NOW);

    assertThatThrownBy(() -> job.assignAirflowRun(null, "run", "{}"))
        .isInstanceOf(NullPointerException.class)
        .hasMessageContaining("airflowDagId");
    assertThatThrownBy(() -> job.assignAirflowRun("dag", null, "{}"))
        .isInstanceOf(NullPointerException.class)
        .hasMessageContaining("airflowRunId");
  }

  @Test
  @DisplayName("Airflow run 할당 후 RUNNING으로 전환한다")
  void markAirflowTriggered_withAssignedAirflowRun_marksRunning() {
    PipelineJob job = PipelineJob.createDomainPackGeneration(1L, 7L, 55L, "{}", NOW);
    job.assignAirflowRun("domain_pack_generation", "pipeline_job_123", "{}");

    job.markAirflowTriggered(NOW);

    assertThat(job.getStatus()).isEqualTo(PipelineJob.STATUS_RUNNING);
    assertThat(job.getStartedAt()).isEqualTo(NOW);
    assertThat(job.getFinishedAt()).isNull();
    assertThat(job.getLastErrorMessage()).isNull();
  }

  @Test
  @DisplayName("Airflow trigger 성공 시 startedAt은 필수다")
  void markAirflowTriggered_missingStartedAt_throws() {
    PipelineJob job = PipelineJob.createDomainPackGeneration(1L, 7L, 55L, "{}", NOW);
    job.assignAirflowRun("domain_pack_generation", "pipeline_job_123", "{}");

    assertThatThrownBy(() -> job.markAirflowTriggered(null))
        .isInstanceOf(NullPointerException.class)
        .hasMessageContaining("startedAt");
  }

  @Test
  @DisplayName("성공 상태는 domain pack과 완료 정보를 기록한다")
  void markSucceeded_setsFinalState() {
    PipelineJob job = PipelineJob.createDomainPackGeneration(1L, 7L, 55L, "{}", NOW);

    job.markSucceeded(3L, null, NOW.plusMinutes(5));

    assertThat(job.getStatus()).isEqualTo(PipelineJob.STATUS_SUCCEEDED);
    assertThat(job.isSucceeded()).isTrue();
    assertThat(job.isFinalized()).isTrue();
    assertThat(job.getDomainPackId()).isEqualTo(3L);
    assertThat(job.getResultSummaryJson()).isEqualTo("{}");
    assertThat(job.getFinishedAt()).isEqualTo(NOW.plusMinutes(5));
    assertThat(job.getLastErrorMessage()).isNull();
  }

  @Test
  @DisplayName("성공 상태 전환은 완료 시간이 필요하다")
  void markSucceeded_missingFinishedAt_throws() {
    PipelineJob job = PipelineJob.createDomainPackGeneration(1L, 7L, 55L, "{}", NOW);

    assertThatThrownBy(() -> job.markSucceeded(3L, "{}", null))
        .isInstanceOf(NullPointerException.class)
        .hasMessageContaining("finishedAt");
  }

  @Test
  @DisplayName("부분 callback 처리 후 RUNNING 상태와 결과 요약을 갱신한다")
  void markRunning_withNullSummary_marksRunningWithDefaultSummary() {
    PipelineJob job = PipelineJob.createDomainPackGeneration(1L, 7L, 55L, "{}", NOW);

    job.markRunning(null);

    assertThat(job.getStatus()).isEqualTo(PipelineJob.STATUS_RUNNING);
    assertThat(job.getResultSummaryJson()).isEqualTo("{}");
    assertThat(job.getFinishedAt()).isNull();
    assertThat(job.getLastErrorMessage()).isNull();
  }

  @Test
  @DisplayName("이미 DomainPack이 연결된 job은 RUNNING이어도 domain-pack draft callback을 다시 받을 수 없다")
  void canAcceptDomainPackDraftCallback_runningWithDomainPack_returnsFalse() {
    PipelineJob job = PipelineJob.createDomainPackGeneration(1L, 7L, 55L, "{}", NOW);
    job.assignAirflowRun("domain_pack_generation", "pipeline_job_123", "{}");
    job.markAirflowTriggered(NOW);
    assertThat(job.canAcceptDomainPackDraftCallback()).isTrue();

    job.markAwaitingIntentCallback(3L, "{}");
    job.markRunning("{}");

    assertThat(job.getStatus()).isEqualTo(PipelineJob.STATUS_RUNNING);
    assertThat(job.getDomainPackId()).isEqualTo(3L);
    assertThat(job.canAcceptDomainPackDraftCallback()).isFalse();
  }

  @Test
  @DisplayName("대기 상태별 callback 수락 여부를 판단한다")
  void callbackAcceptance_reflectsWaitingStatuses() {
    PipelineJob job = PipelineJob.createDomainPackGeneration(1L, 7L, 55L, "{}", NOW);

    assertThat(job.canAcceptDomainPackDraftCallback()).isTrue();
    assertThat(job.canAcceptIntentDraftCallback()).isFalse();
    assertThat(job.canAcceptWorkflowDraftCallback()).isFalse();

    job.markAwaitingIntentCallback(3L, "{\"stage\":\"intent\"}");
    assertThat(job.canAcceptIntentDraftCallback()).isTrue();
    assertThat(job.getResultSummaryJson()).contains("intent");

    job.markAwaitingWorkflowCallback(3L, null);
    assertThat(job.canAcceptWorkflowDraftCallback()).isTrue();
    assertThat(job.getResultSummaryJson()).isEqualTo("{}");
  }

  @Test
  @DisplayName("domain confirmation과 human feedback 대기 상태를 기록한다")
  void markAwaitingReviewCheckpoints_setsWaitingStatuses() {
    PipelineJob job = PipelineJob.createDomainPackGeneration(1L, 7L, 55L, "{}", NOW);

    job.markFailed("previous", NOW.plusMinutes(1));
    job.markAwaitingDomainConfirmation(null);
    assertThat(job.getStatus()).isEqualTo(PipelineJob.STATUS_WAITING_DOMAIN_CONFIRMATION);
    assertThat(job.getResultSummaryJson()).isEqualTo("{}");
    assertThat(job.getFinishedAt()).isNull();
    assertThat(job.getLastErrorMessage()).isNull();

    job.markAwaitingHumanFeedback("{\"stage\":\"feedback\"}");
    assertThat(job.getStatus()).isEqualTo(PipelineJob.STATUS_WAITING_HUMAN_FEEDBACK);
    assertThat(job.getResultSummaryJson()).contains("feedback");
  }

  @Test
  @DisplayName("실패와 취소 상태 helper를 제공한다")
  void stateHelpers_reflectFailedAndCancelledStatus() {
    PipelineJob failed = PipelineJob.createDomainPackGeneration(1L, 7L, 55L, "{}", NOW);
    failed.markFailed("boom", NOW.plusMinutes(1));

    PipelineJob cancelled =
        PipelineJob.create(1L, "CUSTOM", PipelineJob.STATUS_CANCELLED, "MANUAL", "{}", NOW);

    assertThat(failed.isFailed()).isTrue();
    assertThat(failed.isFinalized()).isTrue();
    assertThat(failed.getLastErrorMessage()).isEqualTo("boom");
    assertThat(cancelled.isCancelled()).isTrue();
    assertThat(cancelled.isFinalized()).isTrue();
  }

  @Test
  @DisplayName("종료된 job은 RUNNING 상태로 되돌릴 수 없다")
  void markRunning_finalizedJob_throws() {
    PipelineJob job = PipelineJob.createDomainPackGeneration(1L, 7L, 55L, "{}", NOW);
    job.markSucceeded(3L, "{}", NOW);

    assertThatThrownBy(() -> job.markRunning("{}"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("RUNNING");

    assertThat(job.getStatus()).isEqualTo(PipelineJob.STATUS_SUCCEEDED);
  }
}
