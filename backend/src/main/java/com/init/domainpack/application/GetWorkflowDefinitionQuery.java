package com.init.domainpack.application;

public record GetWorkflowDefinitionQuery(
    Long workspaceId, Long packId, Long versionId, Long workflowId, Long userId) {}
