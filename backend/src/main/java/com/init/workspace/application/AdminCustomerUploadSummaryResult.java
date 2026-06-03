package com.init.workspace.application;

import java.time.OffsetDateTime;

public record AdminCustomerUploadSummaryResult(
    Long datasetId, String datasetKey, String name, String status, OffsetDateTime uploadedAt) {}
