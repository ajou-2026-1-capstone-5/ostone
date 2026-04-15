package com.init.domainpack.application;

public record CreateDomainPackDraftFromPipelineCommand(
    Long workspaceId,
    String packKey,
    String packName,
    Long sourcePipelineJobId,
    String summaryJson) {}
