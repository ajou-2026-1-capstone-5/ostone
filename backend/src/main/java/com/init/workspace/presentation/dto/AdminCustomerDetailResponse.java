package com.init.workspace.presentation.dto;

import com.init.workspace.application.AdminCustomerDetailResult;

public record AdminCustomerDetailResponse(
    AdminCustomerWorkspaceResponse workspace,
    AdminCustomerMemberSummaryResponse members,
    AdminCustomerBillingSummaryResponse billing,
    AdminCustomerUploadSummaryResponse latestUpload,
    AdminCustomerPipelineSummaryResponse pipeline) {

  public static AdminCustomerDetailResponse from(AdminCustomerDetailResult result) {
    return new AdminCustomerDetailResponse(
        AdminCustomerWorkspaceResponse.from(result.workspace()),
        AdminCustomerMemberSummaryResponse.from(result.members()),
        AdminCustomerBillingSummaryResponse.from(result.billing()),
        AdminCustomerUploadSummaryResponse.from(result.latestUpload()),
        AdminCustomerPipelineSummaryResponse.from(result.pipeline()));
  }
}
