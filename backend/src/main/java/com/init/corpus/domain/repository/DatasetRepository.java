package com.init.corpus.domain.repository;

import com.init.corpus.domain.model.Dataset;

public interface DatasetRepository {

  Dataset save(Dataset dataset);

  boolean existsByWorkspaceIdAndDatasetKey(Long workspaceId, String datasetKey);
}
