package com.init.domainpack.application;

public record GetDomainPackVersionDetailQuery(
    Long workspaceId, Long packId, Long versionId, Long userId) {}
