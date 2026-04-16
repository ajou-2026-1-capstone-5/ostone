package com.init.domainpack.application;

public record IntentDraft(
    String intentCode,
    String name,
    String description,
    Integer taxonomyLevel,
    String parentIntentCode,
    String sourceClusterRef,
    String entryConditionJson,
    String evidenceJson,
    String metaJson) {}
