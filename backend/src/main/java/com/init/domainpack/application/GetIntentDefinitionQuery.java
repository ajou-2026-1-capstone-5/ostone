package com.init.domainpack.application;

public record GetIntentDefinitionQuery(
    Long workspaceId, Long packId, Long versionId, Long intentId, Long userId) {}
