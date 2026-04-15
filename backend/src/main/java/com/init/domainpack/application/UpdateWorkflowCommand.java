package com.init.domainpack.application;

public record UpdateWorkflowCommand(
    Long workspaceId,
    Long packId,
    Long versionId,
    Long workflowId,
    Long requesterId,
    String name,
    String description,
    String graphJson) {}
