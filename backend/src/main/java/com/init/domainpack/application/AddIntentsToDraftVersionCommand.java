package com.init.domainpack.application;

import java.util.List;

public record AddIntentsToDraftVersionCommand(
    Long domainPackVersionId, List<IntentDraft> intents) {}
