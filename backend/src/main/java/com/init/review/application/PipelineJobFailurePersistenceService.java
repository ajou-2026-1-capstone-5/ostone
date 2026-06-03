package com.init.review.application;

import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import com.init.workspace.application.WorkspaceFreeOnboardingService;
import java.time.OffsetDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PipelineJobFailurePersistenceService {

  private final PipelineJobRepository pipelineJobRepository;
  private final WorkspaceFreeOnboardingService freeOnboardingService;

  public PipelineJobFailurePersistenceService(
      PipelineJobRepository pipelineJobRepository,
      WorkspaceFreeOnboardingService freeOnboardingService) {
    this.pipelineJobRepository = pipelineJobRepository;
    this.freeOnboardingService = freeOnboardingService;
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void markFailed(PipelineJob job, String message, OffsetDateTime failedAt) {
    job.markFailed(message, failedAt);
    pipelineJobRepository.saveAndFlush(job);
    freeOnboardingService.consumeForFinalPipelineJob(
        job.getWorkspaceId(), job.getId(), job.isFinalized());
  }
}
