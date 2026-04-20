package com.init.domainpack.application;

public record GetSlotDefinitionQuery(
    Long workspaceId, Long packId, Long versionId, Long slotId, Long userId) {}
