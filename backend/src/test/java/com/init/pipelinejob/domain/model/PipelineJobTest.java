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
