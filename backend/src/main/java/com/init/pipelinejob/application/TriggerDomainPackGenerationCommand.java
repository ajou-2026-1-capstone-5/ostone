package com.init.pipelinejob.application;

public record TriggerDomainPackGenerationCommand(
    Long workspaceId,
    Long datasetId,
    Long userId,
    String rawFileObjectKey,
    Long retriedFromPipelineJobId,
    boolean enforceWorkspaceRole) {

  public TriggerDomainPackGenerationCommand(Long workspaceId, Long datasetId, Long userId) {
    this(workspaceId, datasetId, userId, null, null, true);
  }

  public static TriggerDomainPackGenerationCommand adminRetry(
      Long workspaceId,
      Long datasetId,
      Long userId,
      String rawFileObjectKey,
      Long retriedFromPipelineJobId) {
    return new TriggerDomainPackGenerationCommand(
        workspaceId, datasetId, userId, rawFileObjectKey, retriedFromPipelineJobId, false);
  }
}
