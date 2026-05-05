package com.init.pipelinejob.application;

public record DomainPackGenerationTriggerCommand(
    Long workspaceId, Long datasetId, Long pipelineJobId, String dagRunId) {}
