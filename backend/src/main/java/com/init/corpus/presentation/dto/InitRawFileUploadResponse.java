package com.init.corpus.presentation.dto;

public record InitRawFileUploadResponse(
    Long datasetId,
    String datasetKey,
    Long workspaceId,
    String uploadUrl,
    String objectKey,
    String contentType,
    long expiresInSeconds,
    boolean serverSideEncryptionRequired) {}
