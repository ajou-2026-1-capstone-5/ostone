package com.init.domainpack.application;

public record GetIntentDefinitionListQuery(
    Long workspaceId, Long packId, Long versionId, Long userId) {}
