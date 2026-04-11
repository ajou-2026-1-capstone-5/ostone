package com.init.domainpack.presentation.dto;

import java.time.OffsetDateTime;

public record CreateDomainPackDraftResponse(
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
    OffsetDateTime createdAt) {}
