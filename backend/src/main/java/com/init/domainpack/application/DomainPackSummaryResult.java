package com.init.domainpack.application;

import com.init.domainpack.domain.model.DomainPack;
import com.init.domainpack.domain.model.DomainPackVersion;
import java.time.OffsetDateTime;

public record DomainPackSummaryResult(
    Long packId,
    Long workspaceId,
    String name,
    String description,
    String status,
    Long currentVersionId,
    Integer currentVersionNo,
    OffsetDateTime currentVersionPublishedAt,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {

  public static DomainPackSummaryResult from(
      DomainPack pack, DomainPackVersion currentPublishedVersion) {
    return new DomainPackSummaryResult(
        pack.getId(),
        pack.getWorkspaceId(),
        pack.getName(),
        pack.getDescription(),
        pack.getStatus(),
        currentPublishedVersion != null ? currentPublishedVersion.getId() : null,
        currentPublishedVersion != null ? currentPublishedVersion.getVersionNo() : null,
        currentPublishedVersion != null ? currentPublishedVersion.getPublishedAt() : null,
        pack.getCreatedAt(),
        pack.getUpdatedAt());
  }
}
