package com.init.pipelinejob.presentation.dto;

public record PipelineIntentDraftCallbackResponse(
    String status,
    String externalEventId,
    Long domainPackVersionId,
    Integer addedIntentCount,
    Integer skippedIntentCount,
    Integer totalIntentCount,
    Long sourcePipelineJobId) {}
