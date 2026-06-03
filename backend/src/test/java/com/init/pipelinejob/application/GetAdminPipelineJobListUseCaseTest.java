package com.init.pipelinejob.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;

import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import java.lang.reflect.Constructor;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("GetAdminPipelineJobListUseCase")
class GetAdminPipelineJobListUseCaseTest {

  @Mock private PipelineJobRepository pipelineJobRepository;

  private GetAdminPipelineJobListUseCase useCase;
  private final Clock fixedClock =
      Clock.fixed(Instant.parse("2026-06-03T03:00:00Z"), ZoneOffset.UTC);

  @BeforeEach
  void setUp() {
    useCase = new GetAdminPipelineJobListUseCase(pipelineJobRepository, fixedClock);
  }

  @Test
  @DisplayName("필터 조건으로 job을 조회하고 lag/duration과 retry 관계를 계산한다")
  void execute_returnsMetricsAndRetryRelation() {
    PipelineJob failedJob =
        pipelineJob(
            11L,
            PipelineJob.STATUS_FAILED,
            OffsetDateTime.parse("2026-06-03T01:00:00Z"),
            OffsetDateTime.parse("2026-06-03T01:02:00Z"),
            OffsetDateTime.parse("2026-06-03T01:05:00Z"),
            null);
    PipelineJob runningJob =
        pipelineJob(
            12L,
            PipelineJob.STATUS_RUNNING,
            OffsetDateTime.parse("2026-06-03T02:00:00Z"),
            OffsetDateTime.parse("2026-06-03T02:01:00Z"),
            null,
            11L);

    given(
            pipelineJobRepository.findAdminPipelineJobs(
                eq("FAILED"), eq(1L), eq("domain"), eq("pipeline_job"), any(PageRequest.class)))
        .willReturn(new PageImpl<>(List.of(failedJob), PageRequest.of(0, 20), 1));
    given(pipelineJobRepository.findAllByRetriedFromJobIdInOrderByRequestedAtDesc(List.of(11L)))
        .willReturn(List.of(runningJob));

    AdminPipelineJobListResult result =
        useCase.execute(
            new GetAdminPipelineJobListQuery("FAILED", 1L, "domain", "pipeline_job", 0, 20, 60));

    assertThat(result.totalElements()).isEqualTo(1);
    AdminPipelineJobListResult.Item item = result.items().getFirst();
    assertThat(item.pipelineJobId()).isEqualTo(11L);
    assertThat(item.queueLagSeconds()).isEqualTo(120);
    assertThat(item.totalDurationSeconds()).isEqualTo(300);
    assertThat(item.runningDurationSeconds()).isNull();
    assertThat(item.lagExceeded()).isTrue();
    assertThat(item.retryPipelineJobId()).isEqualTo(12L);
  }

  private PipelineJob pipelineJob(
      Long id,
      String status,
      OffsetDateTime requestedAt,
      OffsetDateTime startedAt,
      OffsetDateTime finishedAt,
      Long retriedFromJobId) {
    PipelineJob job = newPipelineJob();
    ReflectionTestUtils.setField(job, "id", id);
    ReflectionTestUtils.setField(job, "workspaceId", 1L);
    ReflectionTestUtils.setField(job, "datasetId", 7L);
    ReflectionTestUtils.setField(job, "jobType", PipelineJob.JOB_TYPE_DOMAIN_PACK_GENERATION);
    ReflectionTestUtils.setField(job, "status", status);
    ReflectionTestUtils.setField(job, "airflowDagId", "domain_pack_generation");
    ReflectionTestUtils.setField(job, "airflowRunId", "pipeline_job_" + id);
    ReflectionTestUtils.setField(job, "requestPayloadJson", "{}");
    ReflectionTestUtils.setField(job, "resultSummaryJson", "{}");
    ReflectionTestUtils.setField(job, "requestedAt", requestedAt);
    ReflectionTestUtils.setField(job, "startedAt", startedAt);
    ReflectionTestUtils.setField(job, "finishedAt", finishedAt);
    ReflectionTestUtils.setField(job, "retriedFromJobId", retriedFromJobId);
    return job;
  }

  private PipelineJob newPipelineJob() {
    try {
      Constructor<PipelineJob> constructor = PipelineJob.class.getDeclaredConstructor();
      constructor.setAccessible(true);
      return constructor.newInstance();
    } catch (ReflectiveOperationException ex) {
      throw new RuntimeException("PipelineJob 테스트 인스턴스 생성 실패", ex);
    }
  }
}
