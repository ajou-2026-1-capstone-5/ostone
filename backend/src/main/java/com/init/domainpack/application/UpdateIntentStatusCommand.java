package com.init.domainpack.application;

public record UpdateIntentStatusCommand(
    Long workspaceId,
    Long packId,
    Long versionId,
    Long intentId,
    Long requesterId,
    String status) {}
