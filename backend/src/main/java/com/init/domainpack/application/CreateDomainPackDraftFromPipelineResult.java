package com.init.domainpack.application;

public record CreateDomainPackDraftFromPipelineResult(
    Long domainPackId,
    Long domainPackVersionId,
    Integer versionNo,
    String packKey,
    boolean createdPack,
    Long sourcePipelineJobId) {}
