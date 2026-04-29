package com.init.domainpack.application;

import com.init.domainpack.domain.model.DomainPackVersion;
import java.time.OffsetDateTime;

public record DomainPackVersionSummaryEntry(
    Long versionId,
    Integer versionNo,
    String lifecycleStatus,
    Long sourcePipelineJobId,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {

  public static DomainPackVersionSummaryEntry from(DomainPackVersion v) {
    return new DomainPackVersionSummaryEntry(
        v.getId(),
        v.getVersionNo(),
        v.getLifecycleStatus(),
        v.getSourcePipelineJobId(),
        v.getCreatedAt(),
        v.getUpdatedAt());
  }
}
