package com.init.pipelinejob.application;

import java.util.List;

public record ReceiveIntentDraftCallbackCommand(
    Long jobId,
    String providedWebhookSecret,
    String externalEventId,
    Long domainPackVersionId,
    List<IntentDraftInput> intents,
    String requestHeadersJson,
    String requestBodyJson) {}
