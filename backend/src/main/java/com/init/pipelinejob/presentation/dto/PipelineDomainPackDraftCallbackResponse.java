package com.init.pipelinejob.presentation.dto;

public record PipelineDomainPackDraftCallbackResponse(
    String status,
    String externalEventId,
    Long domainPackId,
    Long domainPackVersionId,
    Integer versionNo,
    String packKey,
    Boolean createdPack,
    Long sourcePipelineJobId) {}
