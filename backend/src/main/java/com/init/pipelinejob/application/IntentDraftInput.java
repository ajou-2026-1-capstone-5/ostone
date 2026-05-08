package com.init.pipelinejob.application;

public record IntentDraftInput(
    String intentCode,
    String name,
    String description,
    Integer taxonomyLevel,
    String parentIntentCode,
    String sourceClusterRef,
    String entryConditionJson,
    String evidenceJson,
    String metaJson) {}
