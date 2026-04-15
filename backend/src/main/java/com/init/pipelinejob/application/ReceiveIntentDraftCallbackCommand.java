package com.init.pipelinejob.application;

import com.init.domainpack.application.CreateDomainPackDraftCommand;
import java.util.List;

public record ReceiveIntentDraftCallbackCommand(
    Long jobId,
    String providedWebhookSecret,
    String externalEventId,
    Long domainPackVersionId,
    List<CreateDomainPackDraftCommand.IntentDraft> intents,
    String requestHeadersJson,
    String requestBodyJson) {}
