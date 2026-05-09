package com.init.domainpack.application;

public record UpdateDraftIntentCommand(
    Long workspaceId,
    Long packId,
    Long draftVersionId,
    Long intentId,
    Long userId,
    String name,
    String description,
    Integer taxonomyLevel,
    String entryConditionJson,
    String metaJson) {}
