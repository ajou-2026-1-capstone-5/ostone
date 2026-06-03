package com.init.workspace.presentation.dto;

import com.init.workspace.application.AdminCustomerWorkspaceResult;
import java.time.OffsetDateTime;

public record AdminCustomerWorkspaceResponse(
    Long id,
    String workspaceKey,
    String name,
    String description,
    String status,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {

  static AdminCustomerWorkspaceResponse from(AdminCustomerWorkspaceResult result) {
    return new AdminCustomerWorkspaceResponse(
        result.id(),
        result.workspaceKey(),
        result.name(),
        result.description(),
        result.status(),
        result.createdAt(),
        result.updatedAt());
  }
}
