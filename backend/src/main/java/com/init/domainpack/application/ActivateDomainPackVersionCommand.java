package com.init.domainpack.application;

public record ActivateDomainPackVersionCommand(
    Long workspaceId, Long packId, Long versionId, Long userId) {}
