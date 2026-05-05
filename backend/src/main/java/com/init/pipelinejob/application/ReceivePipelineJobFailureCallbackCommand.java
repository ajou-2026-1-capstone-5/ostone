package com.init.pipelinejob.application;

import java.time.OffsetDateTime;

public record ReceivePipelineJobFailureCallbackCommand(
    Long jobId,
    String providedWebhookSecret,
    String externalEventId,
    String dagId,
    String dagRunId,
    String failedStage,
    String reason,
    String message,
    OffsetDateTime occurredAt,
    String requestHeadersJson,
    String requestBodyJson) {}
