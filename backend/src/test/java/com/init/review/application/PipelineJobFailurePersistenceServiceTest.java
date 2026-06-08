package com.init.review.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import com.init.pipelinejob.testfixture.PipelineJobFixtures;
import com.init.workspace.application.WorkspaceFreeOnboardingService;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("PipelineJobFailurePersistenceService")
class PipelineJobFailurePersistenceServiceTest {

  @Mock private PipelineJobRepository pipelineJobRepository;
  @Mock private WorkspaceFreeOnboardingService freeOnboardingService;

  @Test
  @DisplayName("mark failed updates job state and flushes it")
  void markFailed_updatesJobStateAndFlushes() {
    PipelineJobFailurePersistenceService service =
        new PipelineJobFailurePersistenceService(pipelineJobRepository, freeOnboardingService);
    OffsetDateTime now = OffsetDateTime.parse("2026-06-01T01:00:00Z");
    PipelineJob job =
        PipelineJobFixtures.domainPackGeneration(7L)
            .workspaceId(1L)
            .datasetId(3L)
            .triggeredBy(9L)
            .requestedAt(now.minusHours(1))
            .build();

    service.markFailed(job, "airflow offline", now);

    assertThat(job.getStatus()).isEqualTo(PipelineJob.STATUS_FAILED);
    assertThat(job.getLastErrorMessage()).isEqualTo("airflow offline");
    verify(pipelineJobRepository).saveAndFlush(job);
    verify(freeOnboardingService).consumeForFinalPipelineJob(1L, 7L, true);
  }
}
