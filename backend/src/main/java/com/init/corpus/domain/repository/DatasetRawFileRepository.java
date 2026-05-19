package com.init.corpus.domain.repository;

import com.init.corpus.domain.model.DatasetRawFile;
import java.util.Optional;

public interface DatasetRawFileRepository {

  DatasetRawFile save(DatasetRawFile rawFile);

  Optional<DatasetRawFile> findFirstByDatasetIdOrderByUploadedAtDesc(Long datasetId);
}
