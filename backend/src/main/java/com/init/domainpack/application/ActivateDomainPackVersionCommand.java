package com.init.domainpack.application;

public record ActivateDomainPackVersionCommand(
    Long workspaceId, Long packId, Long versionId, Long userId, String description) {

  public ActivateDomainPackVersionCommand(
      Long workspaceId, Long packId, Long versionId, Long userId) {
    this(workspaceId, packId, versionId, userId, null);
  }
}
