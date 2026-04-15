package com.init.pipelinejob.application;

public record ReceiveDomainPackDraftCallbackCommand(
    Long jobId,
    String providedWebhookSecret,
    String externalEventId,
    String packKey,
    String packName,
    String summaryJson,
    String requestHeadersJson,
    String requestBodyJson) {}
