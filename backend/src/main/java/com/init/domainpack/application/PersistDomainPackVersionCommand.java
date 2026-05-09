package com.init.domainpack.application;

public record PersistDomainPackVersionCommand(
    Long workspaceId, Long packId, Long createdBy, Long sourcePipelineJobId, String summaryJson) {}
