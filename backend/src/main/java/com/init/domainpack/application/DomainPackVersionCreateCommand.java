package com.init.domainpack.application;

public record DomainPackVersionCreateCommand(
    Long workspaceId, Long packId, Long createdBy, Long sourcePipelineJobId, String summaryJson) {}
