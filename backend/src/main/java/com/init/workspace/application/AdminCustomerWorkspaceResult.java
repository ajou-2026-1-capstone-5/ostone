package com.init.workspace.application;

import java.time.OffsetDateTime;

public record AdminCustomerWorkspaceResult(
    Long id,
    String workspaceKey,
    String name,
    String description,
    String status,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    String freeOnboardingStatus,
    Long freeOnboardingDatasetId,
    Long freeOnboardingPipelineJobId,
    OffsetDateTime freeOnboardingStartedAt,
    OffsetDateTime freeOnboardingConsumedAt) {

  public AdminCustomerWorkspaceResult(
      Long id,
      String workspaceKey,
      String name,
      String description,
      String status,
      OffsetDateTime createdAt,
      OffsetDateTime updatedAt) {
    this(
        id,
        workspaceKey,
        name,
        description,
        status,
        createdAt,
        updatedAt,
        "AVAILABLE",
        null,
        null,
        null,
        null);
  }
}
