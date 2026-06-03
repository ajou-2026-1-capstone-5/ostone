package com.init.workspace.application;

public record AdminCustomerSummaryResult(
    AdminCustomerWorkspaceResult workspace,
    long memberCount,
    AdminCustomerBillingSummaryResult billing,
    AdminCustomerUploadSummaryResult latestUpload,
    AdminCustomerPipelineJobResult latestPipelineJob) {}
