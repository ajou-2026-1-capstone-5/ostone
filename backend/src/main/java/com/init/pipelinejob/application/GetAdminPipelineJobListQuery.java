package com.init.pipelinejob.application;

public record GetAdminPipelineJobListQuery(
    String status,
    Long workspaceId,
    String dagId,
    String runId,
    int page,
    int size,
    long lagThresholdSeconds) {}
