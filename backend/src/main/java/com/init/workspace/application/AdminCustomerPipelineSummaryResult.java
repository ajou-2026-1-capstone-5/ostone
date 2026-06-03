package com.init.workspace.application;

import java.util.List;

public record AdminCustomerPipelineSummaryResult(
    long totalCount,
    long runningCount,
    long succeededCount,
    long failedCount,
    AdminCustomerPipelineJobResult latestJob,
    List<AdminCustomerPipelineJobResult> recentJobs) {}
