package com.init.domainpack.application;

public record CreateIntentRevisionDraftCommand(
    Long workspaceId, Long packId, Long versionId, Long userId, String reason) {}
