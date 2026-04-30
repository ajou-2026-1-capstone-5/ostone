package com.init.domainpack.application;

import java.time.OffsetDateTime;

public record DomainPackVersionDetailResult(
    Long versionId,
    Long packId,
    Integer versionNo,
    String lifecycleStatus,
    Long sourcePipelineJobId,
    String summaryJson,
    long intentCount,
    long slotCount,
    long policyCount,
    long riskCount,
    long workflowCount,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {}
