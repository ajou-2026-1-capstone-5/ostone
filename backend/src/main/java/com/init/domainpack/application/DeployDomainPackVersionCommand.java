package com.init.domainpack.application;

public record DeployDomainPackVersionCommand(
    Long workspaceId, Long packId, Long versionId, Long userId) {}
