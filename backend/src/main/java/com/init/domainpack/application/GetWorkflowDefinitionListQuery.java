package com.init.domainpack.application;

public record GetWorkflowDefinitionListQuery(
    Long workspaceId, Long packId, Long versionId, Long userId, Long intentDefinitionId) {

  public GetWorkflowDefinitionListQuery(
      Long workspaceId, Long packId, Long versionId, Long userId) {
    this(workspaceId, packId, versionId, userId, null);
  }
}
