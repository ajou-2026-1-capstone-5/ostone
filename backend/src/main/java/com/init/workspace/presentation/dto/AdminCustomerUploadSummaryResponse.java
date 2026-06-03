package com.init.workspace.presentation.dto;

import com.init.workspace.application.AdminCustomerUploadSummaryResult;
import java.time.OffsetDateTime;

public record AdminCustomerUploadSummaryResponse(
    Long datasetId, String datasetKey, String name, String status, OffsetDateTime uploadedAt) {

  static AdminCustomerUploadSummaryResponse from(AdminCustomerUploadSummaryResult result) {
    if (result == null) {
      return null;
    }
    return new AdminCustomerUploadSummaryResponse(
        result.datasetId(),
        result.datasetKey(),
        result.name(),
        result.status(),
        result.uploadedAt());
  }
}
