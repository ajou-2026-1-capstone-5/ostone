package com.init.workspace.application;

public record AdminCustomerDetailResult(
    AdminCustomerWorkspaceResult workspace,
    AdminCustomerMemberSummaryResult members,
    AdminCustomerBillingSummaryResult billing,
    AdminCustomerUploadSummaryResult latestUpload,
    AdminCustomerPipelineSummaryResult pipeline) {}
