package com.init.domainpack.application;

import com.init.domainpack.domain.model.DomainPackVersion;
import java.time.OffsetDateTime;

public record ActivateDomainPackVersionResult(
    Long id,
    Long domainPackId,
    Integer versionNo,
    String lifecycleStatus,
    String description,
    OffsetDateTime publishedAt,
    OffsetDateTime updatedAt) {

  public static ActivateDomainPackVersionResult from(DomainPackVersion version) {
    return new ActivateDomainPackVersionResult(
        version.getId(),
        version.getDomainPackId(),
        version.getVersionNo(),
        version.getLifecycleStatus(),
        version.getDescription(),
        version.getPublishedAt(),
        version.getUpdatedAt());
  }
}
