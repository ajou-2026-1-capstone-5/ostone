package com.init.domainpack.application;

public record GetSlotDefinitionListQuery(
    Long workspaceId, Long packId, Long versionId, Long userId) {}
