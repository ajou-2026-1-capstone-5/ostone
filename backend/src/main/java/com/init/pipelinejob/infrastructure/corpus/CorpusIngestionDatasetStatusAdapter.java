package com.init.pipelinejob.infrastructure.corpus;

import com.init.corpus.domain.repository.DatasetRepository;
import com.init.pipelinejob.application.IngestionDatasetStatusPort;
import org.springframework.stereotype.Component;

@Component
public class CorpusIngestionDatasetStatusAdapter implements IngestionDatasetStatusPort {

  private final DatasetRepository datasetRepository;

  public CorpusIngestionDatasetStatusAdapter(DatasetRepository datasetRepository) {
    this.datasetRepository = datasetRepository;
  }

  @Override
  public void markIngestionTriggerFailed(Long workspaceId, Long datasetId) {
    datasetRepository
        .findByIdAndWorkspaceIdForUpdate(datasetId, workspaceId)
        .filter(dataset -> dataset.markIngestionTriggerFailed())
        .ifPresent(datasetRepository::save);
  }
}
