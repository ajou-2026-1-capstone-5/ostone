package com.init.domainpack.application;

import com.init.domainpack.domain.model.IntentDefinition;
import java.util.List;

record PersistedDraftIntents(
    List<IntentDefinition> savedIntents, int skippedIntentCount, int totalIntentCount) {}
