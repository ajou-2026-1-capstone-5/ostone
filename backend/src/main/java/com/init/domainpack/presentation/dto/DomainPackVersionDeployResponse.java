package com.init.domainpack.presentation.dto;

import java.time.OffsetDateTime;

public record DomainPackVersionDeployResponse(
    Long id,
    Long domainPackId,
    Integer versionNo,
    String lifecycleStatus,
    OffsetDateTime publishedAt,
    OffsetDateTime updatedAt) {}
