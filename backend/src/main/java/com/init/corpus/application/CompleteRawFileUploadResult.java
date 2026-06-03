package com.init.corpus.application;

import com.init.corpus.domain.model.DatasetStatus;

public record CompleteRawFileUploadResult(
    Long datasetId,
    String datasetKey,
    Long workspaceId,
    String objectKey,
    long sizeBytes,
    DatasetStatus status) {}
