package com.init.corpus.application;

public record InitRawFileUploadResult(
    Long datasetId,
    String datasetKey,
    Long workspaceId,
    String uploadUrl,
    String objectKey,
    String contentType,
    long expiresInSeconds,
    boolean serverSideEncryptionRequired) {}
