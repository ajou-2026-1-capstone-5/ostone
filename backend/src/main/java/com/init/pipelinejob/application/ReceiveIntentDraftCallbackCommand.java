package com.init.pipelinejob.application;

import com.init.domainpack.application.IntentDraft;
import java.util.List;

public record ReceiveIntentDraftCallbackCommand(
    Long jobId,
    String providedWebhookSecret,
    String externalEventId,
    Long domainPackVersionId,
    List<IntentDraft> intents,
    String requestHeadersJson,
    String requestBodyJson) {}
