package com.init.domainpack.application;

import com.init.domainpack.domain.model.DomainPack;
import java.time.OffsetDateTime;

public record DomainPackSummaryResult(
    Long packId, Long workspaceId, String name, String description, OffsetDateTime createdAt) {

  public static DomainPackSummaryResult from(DomainPack pack) {
    return new DomainPackSummaryResult(
        pack.getId(),
        pack.getWorkspaceId(),
        pack.getName(),
        pack.getDescription(),
        pack.getCreatedAt());
  }
}
