package com.init.corpus.presentation.dto;

import com.init.corpus.domain.model.DatasetStatus;

public record CompleteRawFileUploadResponse(
    Long datasetId,
    String datasetKey,
    Long workspaceId,
    String objectKey,
    long sizeBytes,
    DatasetStatus status) {}
