package com.init.review.application;

import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import java.time.OffsetDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PipelineJobFailurePersistenceService {

  private final PipelineJobRepository pipelineJobRepository;

  public PipelineJobFailurePersistenceService(PipelineJobRepository pipelineJobRepository) {
    this.pipelineJobRepository = pipelineJobRepository;
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void markFailed(PipelineJob job, String message, OffsetDateTime failedAt) {
    job.markFailed(message, failedAt);
    pipelineJobRepository.saveAndFlush(job);
  }
}
