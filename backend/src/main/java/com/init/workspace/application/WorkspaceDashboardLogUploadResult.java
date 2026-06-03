package com.init.workspace.application;

import java.time.OffsetDateTime;

public record WorkspaceDashboardLogUploadResult(
    Long datasetId,
    String datasetKey,
    String datasetName,
    String datasetStatus,
    OffsetDateTime uploadedAt) {}
