package com.init.domainpack.application;

public record UpdateRiskStatusCommand(
    Long workspaceId, Long packId, Long versionId, Long riskId, Long requesterId, String status) {}
