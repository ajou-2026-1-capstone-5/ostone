package com.init.pipelinejob.application;

public record GetLatestPipelineJobQuery(
    Long workspaceId, Long datasetId, String jobType, Long userId) {}
