package com.init.workspace.presentation.dto;

import com.init.workspace.application.AdminCustomerSummaryResult;

public record AdminCustomerSummaryResponse(
    AdminCustomerWorkspaceResponse workspace,
    long memberCount,
    AdminCustomerBillingSummaryResponse billing,
    AdminCustomerUploadSummaryResponse latestUpload,
    AdminCustomerPipelineJobResponse latestPipelineJob) {

  static AdminCustomerSummaryResponse from(AdminCustomerSummaryResult result) {
    return new AdminCustomerSummaryResponse(
        AdminCustomerWorkspaceResponse.from(result.workspace()),
        result.memberCount(),
        AdminCustomerBillingSummaryResponse.from(result.billing()),
        AdminCustomerUploadSummaryResponse.from(result.latestUpload()),
        AdminCustomerPipelineJobResponse.from(result.latestPipelineJob()));
  }
}
