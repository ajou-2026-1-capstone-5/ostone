package com.init.domainpack.application;

public record GetWorkflowTransitionQuery(
    Long workspaceId,
    Long packId,
    Long versionId,
    Long workflowId,
    String transitionId,
    Long userId) {}
