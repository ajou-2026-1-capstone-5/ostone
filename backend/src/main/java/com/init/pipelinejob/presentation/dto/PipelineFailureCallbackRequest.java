package com.init.pipelinejob.presentation.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;

public record PipelineFailureCallbackRequest(
    @NotBlank @Size(max = 255) String externalEventId,
    @NotBlank @Size(max = 255) String dagId,
    @NotBlank @Size(max = 255) String dagRunId,
    @NotBlank @Size(max = 100) String failedStage,
    @NotBlank @Size(max = 100) String reason,
    @NotBlank @Size(max = 5000) String message,
    @NotNull OffsetDateTime occurredAt,
    JsonNode error) {}
