package com.init.pipelinejob.presentation.dto;

public record PipelineJobErrorResponse(
    String code, String message, Long pipelineJobId, String status) {}
