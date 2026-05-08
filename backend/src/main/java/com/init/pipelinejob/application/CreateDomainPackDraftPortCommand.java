package com.init.pipelinejob.application;

public record CreateDomainPackDraftPortCommand(
    Long workspaceId,
    String packKey,
    String packName,
    Long sourcePipelineJobId,
    String summaryJson) {}
