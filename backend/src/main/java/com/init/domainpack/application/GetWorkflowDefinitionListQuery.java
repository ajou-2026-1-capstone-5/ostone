package com.init.domainpack.application;

public record GetWorkflowDefinitionListQuery(
    Long workspaceId, Long packId, Long versionId, Long userId) {}
