package com.init.domainpack.application;

public record GetRiskDefinitionQuery(
    Long workspaceId, Long packId, Long versionId, Long riskId, Long userId) {}
