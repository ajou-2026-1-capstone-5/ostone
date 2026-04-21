package com.init.domainpack.application;

public record GetRiskDefinitionListQuery(
    Long workspaceId, Long packId, Long versionId, Long userId) {}
