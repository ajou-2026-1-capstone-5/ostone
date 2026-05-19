package com.init.pipelinejob.application;

import java.util.Optional;

public interface DatasetRawFileLookupPort {

  Optional<String> findLatestObjectKeyByDatasetId(Long datasetId);
}
