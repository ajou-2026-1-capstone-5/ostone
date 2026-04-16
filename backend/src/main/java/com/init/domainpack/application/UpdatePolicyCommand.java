package com.init.domainpack.application;

public record UpdatePolicyCommand(
    Long workspaceId,
    Long packId,
    Long versionId,
    Long policyId,
    Long requesterId,
    String name,
    String description,
    String severity,
    String conditionJson,
    String actionJson,
    String evidenceJson,
    String metaJson) {}
