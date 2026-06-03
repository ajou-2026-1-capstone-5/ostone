package com.init.workspace.application;

import java.time.OffsetDateTime;

public record AdminCustomerWorkspaceResult(
    Long id,
    String workspaceKey,
    String name,
    String description,
    String status,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {}
