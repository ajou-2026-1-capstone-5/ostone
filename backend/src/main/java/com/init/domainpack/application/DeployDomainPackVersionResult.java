package com.init.domainpack.application;

import com.init.domainpack.domain.model.DomainPackVersion;
import java.time.OffsetDateTime;

public record DeployDomainPackVersionResult(
    Long id,
    Long domainPackId,
    Integer versionNo,
    String lifecycleStatus,
    OffsetDateTime publishedAt,
    OffsetDateTime updatedAt) {

  public static DeployDomainPackVersionResult from(DomainPackVersion version) {
    return new DeployDomainPackVersionResult(
        version.getId(),
        version.getDomainPackId(),
        version.getVersionNo(),
        version.getLifecycleStatus(),
        version.getPublishedAt(),
        version.getUpdatedAt());
  }
}
