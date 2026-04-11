package com.init.domainpack.application;

import com.init.domainpack.domain.model.DomainPackVersion;
import java.time.OffsetDateTime;

public record CreateDomainPackDraftResult(
    Long versionId,
    Long domainPackId,
    Integer versionNo,
    String lifecycleStatus,
    Long sourcePipelineJobId,
    int intentCount,
    int slotCount,
    int policyCount,
    int riskCount,
    int workflowCount,
    OffsetDateTime createdAt) {

  public static CreateDomainPackDraftResult from(
      DomainPackVersion version,
      int intentCount,
      int slotCount,
      int policyCount,
      int riskCount,
      int workflowCount) {
    return new CreateDomainPackDraftResult(
        version.getId(),
        version.getDomainPackId(),
        version.getVersionNo(),
        version.getLifecycleStatus(),
        version.getSourcePipelineJobId(),
        intentCount,
        slotCount,
        policyCount,
        riskCount,
        workflowCount,
        version.getCreatedAt());
  }
}
