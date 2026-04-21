package com.init.domainpack.application;

public record GetPolicyDefinitionListQuery(
    Long workspaceId, Long packId, Long versionId, Long userId) {}
