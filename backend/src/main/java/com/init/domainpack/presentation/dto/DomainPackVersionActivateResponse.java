package com.init.domainpack.presentation.dto;

import java.time.OffsetDateTime;

public record DomainPackVersionActivateResponse(
    Long id,
    Long domainPackId,
    Integer versionNo,
    String lifecycleStatus,
    OffsetDateTime publishedAt,
    OffsetDateTime updatedAt) {}
