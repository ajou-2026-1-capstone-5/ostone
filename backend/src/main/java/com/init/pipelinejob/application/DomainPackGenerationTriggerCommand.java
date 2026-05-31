package com.init.pipelinejob.application;

public record DomainPackGenerationTriggerCommand(
    Long workspaceId,
    Long datasetId,
    Long pipelineJobId,
    String dagRunId,
    String objectKey,
    String runMode,
    Long parentPipelineJobId,
    String upstreamManifestPath,
    String confirmedDomainProfilePath,
    String feedbackConstraintsPath,
    String confirmedDomainProfileJson,
    String feedbackConstraintsJson,
    Boolean skipFeedbackCheckpoint) {

  public static DomainPackGenerationTriggerCommand initial(
      Long workspaceId, Long datasetId, Long pipelineJobId, String dagRunId, String objectKey) {
    return new DomainPackGenerationTriggerCommand(
        workspaceId,
        datasetId,
        pipelineJobId,
        dagRunId,
        objectKey,
        "INITIAL",
        null,
        null,
        null,
        null,
        null,
        null,
        false);
  }

  public DomainPackGenerationTriggerCommand(
      Long workspaceId, Long datasetId, Long pipelineJobId, String dagRunId, String objectKey) {
    this(
        workspaceId,
        datasetId,
        pipelineJobId,
        dagRunId,
        objectKey,
        "INITIAL",
        null,
        null,
        null,
        null,
        null,
        null,
        false);
  }
}
