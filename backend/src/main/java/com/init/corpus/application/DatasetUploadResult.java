package com.init.corpus.application;

public record DatasetUploadResult(
    Long datasetId, String datasetKey, Long workspaceId, int conversationCount) {}
