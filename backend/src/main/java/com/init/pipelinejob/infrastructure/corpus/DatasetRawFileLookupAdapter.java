package com.init.pipelinejob.infrastructure.corpus;

import com.init.corpus.domain.repository.DatasetRawFileRepository;
import com.init.pipelinejob.application.DatasetRawFileLookupPort;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class DatasetRawFileLookupAdapter implements DatasetRawFileLookupPort {

  private final DatasetRawFileRepository datasetRawFileRepository;

  public DatasetRawFileLookupAdapter(DatasetRawFileRepository datasetRawFileRepository) {
    this.datasetRawFileRepository = datasetRawFileRepository;
  }

  @Override
  public Optional<String> findLatestObjectKeyByDatasetId(Long datasetId) {
    return datasetRawFileRepository
        .findFirstByDatasetIdOrderByUploadedAtDesc(datasetId)
        .map(file -> file.getObjectKey());
  }
}
