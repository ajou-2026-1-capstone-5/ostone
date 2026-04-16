package com.init.domainpack.application;

public record UpdatePolicyStatusCommand(
    Long workspaceId,
    Long packId,
    Long versionId,
    Long policyId,
    Long requesterId,
    String status) {}
