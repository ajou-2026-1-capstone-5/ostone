package com.init.workspace.presentation.dto;

import com.init.workspace.application.AdminCustomerPipelineJobResult;
import java.time.OffsetDateTime;

public record AdminCustomerPipelineJobResponse(
    Long id,
    String jobType,
    String status,
    OffsetDateTime requestedAt,
    OffsetDateTime startedAt,
    OffsetDateTime finishedAt) {

  static AdminCustomerPipelineJobResponse from(AdminCustomerPipelineJobResult result) {
    if (result == null) {
      return null;
    }
    return new AdminCustomerPipelineJobResponse(
        result.id(),
        result.jobType(),
        result.status(),
        result.requestedAt(),
        result.startedAt(),
        result.finishedAt());
  }
}
