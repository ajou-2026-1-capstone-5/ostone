package com.init.corpus.presentation.dto;

public record DatasetUploadResponse(
    Long datasetId,
    String datasetKey,
    Long workspaceId,
    String status,
    String piiRedactionStatus,
    int conversationCount) {}
