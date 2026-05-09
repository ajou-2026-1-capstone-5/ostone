package com.init.domainpack.application;

public record DiscardDraftVersionCommand(
    Long workspaceId, Long packId, Long draftVersionId, Long userId) {}
