package com.init.payment.application;

import java.time.OffsetDateTime;

public record WorkspaceQuota(
    Long workspaceId,
    String planKey,
    int memberLimit,
    int datasetUploadLimit,
    int pipelineRunLimit,
    OffsetDateTime currentPeriodStart,
    OffsetDateTime currentPeriodEnd) {}
