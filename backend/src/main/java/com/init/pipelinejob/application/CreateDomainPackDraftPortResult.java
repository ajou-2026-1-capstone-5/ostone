package com.init.pipelinejob.application;

public record CreateDomainPackDraftPortResult(
    Long domainPackId,
    Long domainPackVersionId,
    Integer versionNo,
    String packKey,
    boolean createdPack,
    Long sourcePipelineJobId) {}
