package com.init.domainpack.application;

import com.init.domainpack.domain.model.DomainPack;
import com.init.domainpack.domain.model.DomainPackVersion;
import java.time.OffsetDateTime;
import java.util.List;

public record DomainPackDetailResult(
    Long packId,
    Long workspaceId,
    String code,
    String name,
    String description,
    List<DomainPackVersionSummaryEntry> versions,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {

  public static DomainPackDetailResult from(DomainPack pack, List<DomainPackVersion> versions) {
    return new DomainPackDetailResult(
        pack.getId(),
        pack.getWorkspaceId(),
        pack.getPackKey(),
        pack.getName(),
        pack.getDescription(),
        versions.stream().map(DomainPackVersionSummaryEntry::from).toList(),
        pack.getCreatedAt(),
        pack.getUpdatedAt());
  }
}
