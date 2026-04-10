package com.init.corpus.presentation.dto;

import com.init.corpus.domain.model.DatasetStatus;
import com.init.corpus.domain.model.PiiRedactionStatus;

public record DatasetUploadResponse(
    Long datasetId,
    String datasetKey,
    Long workspaceId,
    DatasetStatus status,
    PiiRedactionStatus piiRedactionStatus,
    int conversationCount) {}
