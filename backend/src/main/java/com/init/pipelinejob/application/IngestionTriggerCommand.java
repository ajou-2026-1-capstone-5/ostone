package com.init.pipelinejob.application;

public record IngestionTriggerCommand(
    Long workspaceId, Long datasetId, Long pipelineJobId, String dagRunId, String objectKey) {}
