package com.init.domainpack.application;

public record GetWorkflowTransitionListQuery(
    Long workspaceId, Long packId, Long versionId, Long workflowId, Long userId) {}
