package com.init.corpus.presentation.dto;

import com.init.corpus.domain.model.DatasetStatus;
import com.init.corpus.domain.model.PiiRedactionStatus;

public record RawFileUploadResponse(
    Long datasetId,
    String datasetKey,
    Long workspaceId,
    String objectKey,
    String originalFilename,
    Long sizeBytes,
    DatasetStatus status,
    PiiRedactionStatus piiRedactionStatus,
    int conversationCount) {}
