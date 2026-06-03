package com.init.workspace.presentation.dto;

import com.init.workspace.application.AdminCustomerPipelineSummaryResult;
import java.util.List;

public record AdminCustomerPipelineSummaryResponse(
    long totalCount,
    long runningCount,
    long succeededCount,
    long failedCount,
    AdminCustomerPipelineJobResponse latestJob,
    List<AdminCustomerPipelineJobResponse> recentJobs) {

  static AdminCustomerPipelineSummaryResponse from(AdminCustomerPipelineSummaryResult result) {
    return new AdminCustomerPipelineSummaryResponse(
        result.totalCount(),
        result.runningCount(),
        result.succeededCount(),
        result.failedCount(),
        AdminCustomerPipelineJobResponse.from(result.latestJob()),
        result.recentJobs().stream().map(AdminCustomerPipelineJobResponse::from).toList());
  }
}
