package com.init.corpus.application;

import com.init.corpus.domain.model.DatasetStatus;
import com.init.corpus.domain.model.PiiRedactionStatus;

public record RawFileUploadResult(
    Long datasetId,
    String datasetKey,
    Long workspaceId,
    String objectKey,
    String originalFilename,
    long sizeBytes,
    DatasetStatus status,
    PiiRedactionStatus piiRedactionStatus,
    int conversationCount) {}
