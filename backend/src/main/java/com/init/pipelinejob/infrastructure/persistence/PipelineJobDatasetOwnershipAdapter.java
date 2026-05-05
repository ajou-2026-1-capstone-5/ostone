package com.init.pipelinejob.infrastructure.persistence;

import com.init.corpus.domain.repository.DatasetRepository;
import com.init.pipelinejob.application.DatasetOwnershipPort;
import org.springframework.stereotype.Component;

@Component
public class PipelineJobDatasetOwnershipAdapter implements DatasetOwnershipPort {

  private final DatasetRepository datasetRepository;

  public PipelineJobDatasetOwnershipAdapter(DatasetRepository datasetRepository) {
    this.datasetRepository = datasetRepository;
  }

  @Override
  public boolean existsByIdAndWorkspaceId(Long datasetId, Long workspaceId) {
    return datasetRepository.existsByIdAndWorkspaceId(datasetId, workspaceId);
  }
}
