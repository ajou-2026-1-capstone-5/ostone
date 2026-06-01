package com.init.domainpack.presentation.dto;

import java.time.OffsetDateTime;

public record DomainPackVersionActivateResponse(
    Long id,
    Long domainPackId,
    Integer versionNo,
    String lifecycleStatus,
    String description,
    OffsetDateTime publishedAt,
    OffsetDateTime updatedAt) {}
