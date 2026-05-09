package com.init.domainpack.application;

import com.init.domainpack.domain.model.DomainPackVersion;

public record DomainPackVersionCloneCommand(
    Long workspaceId,
    Long packId,
    DomainPackVersion baseVersion,
    Long createdBy,
    DomainPackDraftSourceType sourceType,
    String reason) {}
