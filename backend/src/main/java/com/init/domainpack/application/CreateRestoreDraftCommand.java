package com.init.domainpack.application;

public record CreateRestoreDraftCommand(
    Long workspaceId, Long packId, Long versionId, Long userId, String reason) {}
