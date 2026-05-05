package com.init.pipelinejob.presentation.dto;

public record PipelineFailureCallbackResponse(
    String status, String externalEventId, Long pipelineJobId, String jobStatus) {}
