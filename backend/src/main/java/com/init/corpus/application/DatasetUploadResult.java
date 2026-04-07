package com.init.corpus.application;

import com.init.corpus.domain.model.DatasetStatus;
import com.init.corpus.domain.model.PiiRedactionStatus;

public record DatasetUploadResult(
    Long datasetId,
    String datasetKey,
    Long workspaceId,
    DatasetStatus status,
    PiiRedactionStatus piiRedactionStatus,
    int conversationCount) {}
