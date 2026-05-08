package com.init.pipelinejob.application;

import java.util.List;

public record AddIntentsToDraftVersionPortCommand(
    Long domainPackVersionId, List<IntentDraftInput> intents) {}
