package com.init.domainpack.application;

public record GetPolicyDefinitionQuery(
    Long workspaceId, Long packId, Long versionId, Long policyId, Long userId) {}
