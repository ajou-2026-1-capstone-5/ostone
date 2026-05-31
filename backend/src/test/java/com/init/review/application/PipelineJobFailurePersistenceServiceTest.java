package com.init.review.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("PipelineJobFailurePersistenceService")
class PipelineJobFailurePersistenceServiceTest {

  @Mock private PipelineJobRepository pipelineJobRepository;

  @Test
  @DisplayName("mark failed updates job state and flushes it")
  void markFailed_updatesJobStateAndFlushes() {
    PipelineJobFailurePersistenceService service =
        new PipelineJobFailurePersistenceService(pipelineJobRepository);
    OffsetDateTime now = OffsetDateTime.parse("2026-06-01T01:00:00Z");
    PipelineJob job = PipelineJob.createDomainPackGeneration(1L, 3L, 9L, "{}", now.minusHours(1));
    ReflectionTestUtils.setField(job, "id", 7L);

    service.markFailed(job, "airflow offline", now);

    assertThat(job.getStatus()).isEqualTo(PipelineJob.STATUS_FAILED);
    assertThat(job.getLastErrorMessage()).isEqualTo("airflow offline");
    verify(pipelineJobRepository).saveAndFlush(job);
  }
}
