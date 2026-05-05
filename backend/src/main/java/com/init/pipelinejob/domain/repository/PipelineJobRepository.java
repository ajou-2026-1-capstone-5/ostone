package com.init.pipelinejob.domain.repository;

import com.init.pipelinejob.domain.model.PipelineJob;
import java.util.Optional;

public interface PipelineJobRepository {

  Optional<PipelineJob> findById(Long id);

  Optional<PipelineJob> findActiveDomainPackGenerationJob(Long workspaceId, Long datasetId);

  PipelineJob saveAndFlush(PipelineJob pipelineJob);
}
