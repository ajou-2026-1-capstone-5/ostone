package com.init.review.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.pipelinejob.application.DomainPackGenerationTriggerCommand;
import com.init.pipelinejob.application.DomainPackGenerationTriggerPort;
import com.init.pipelinejob.application.exception.AirflowTriggerFailedException;
import com.init.pipelinejob.domain.model.PipelineArtifact;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.repository.PipelineArtifactRepository;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import com.init.shared.application.exception.BadRequestException;
import java.time.Clock;
import java.time.OffsetDateTime;
import org.springframework.stereotype.Service;

@Service
public class PipelineReviewReplayOrchestrator {

  private static final String ARTIFACT_DOMAIN_CANDIDATES = "DOMAIN_CANDIDATES";
  private static final String ARTIFACT_CONFIRMED_DOMAIN_PROFILE = "CONFIRMED_DOMAIN_PROFILE";
  private static final String FIELD_UPSTREAM_MANIFEST_PATH = "upstreamManifestPath";

  private final PipelineArtifactRepository pipelineArtifactRepository;
  private final PipelineJobRepository pipelineJobRepository;
  private final PipelineJobFailurePersistenceService failurePersistenceService;
  private final DomainPackGenerationTriggerPort triggerPort;
  private final PipelineReviewCheckpointJsonSupport jsonSupport;
  private final Clock clock;

  public PipelineReviewReplayOrchestrator(
      PipelineArtifactRepository pipelineArtifactRepository,
      PipelineJobRepository pipelineJobRepository,
      PipelineJobFailurePersistenceService failurePersistenceService,
      DomainPackGenerationTriggerPort triggerPort,
      PipelineReviewCheckpointJsonSupport jsonSupport,
      Clock clock) {
    this.pipelineArtifactRepository = pipelineArtifactRepository;
    this.pipelineJobRepository = pipelineJobRepository;
    this.failurePersistenceService = failurePersistenceService;
    this.triggerPort = triggerPort;
    this.jsonSupport = jsonSupport;
    this.clock = clock;
  }

  public void triggerDomainConfirmedReplay(
      PipelineJob parentJob, String confirmedDomainProfileJson) {
    triggerReplay(parentJob, "DOMAIN_CONFIRMED_REPLAY", confirmedDomainProfileJson, null, false);
  }

  public void triggerFeedbackReplay(PipelineJob parentJob, String feedbackConstraintsJson) {
    triggerReplay(
        parentJob,
        "FEEDBACK_REPLAY",
        latestArtifactJsonOrNull(parentJob.getId(), ARTIFACT_CONFIRMED_DOMAIN_PROFILE),
        feedbackConstraintsJson,
        true);
  }

  private void triggerReplay(
      PipelineJob parentJob,
      String runMode,
      String confirmedDomainProfileJson,
      String feedbackConstraintsJson,
      boolean skipFeedbackCheckpoint) {
    String upstreamManifestPath = upstreamManifestPath(parentJob);
    String dagRunId = "pipeline_job_" + parentJob.getId() + "_" + runMode.toLowerCase();
    try {
      triggerPort.trigger(
          new DomainPackGenerationTriggerCommand(
              parentJob.getWorkspaceId(),
              parentJob.getDatasetId(),
              parentJob.getId(),
              dagRunId,
              "",
              runMode,
              parentJob.getId(),
              upstreamManifestPath,
              null,
              null,
              confirmedDomainProfileJson,
              feedbackConstraintsJson,
              skipFeedbackCheckpoint));
      parentJob.markRunning(
          replaySummaryJson(
              runMode, upstreamManifestPath, confirmedDomainProfileJson, feedbackConstraintsJson));
      pipelineJobRepository.saveAndFlush(parentJob);
    } catch (AirflowTriggerFailedException ex) {
      failurePersistenceService.markFailed(parentJob, ex.getMessage(), OffsetDateTime.now(clock));
      throw ex;
    }
  }

  private String upstreamManifestPath(PipelineJob job) {
    JsonNode summary = jsonSupport.readJson(job.getResultSummaryJson());
    String value = jsonSupport.text(summary, FIELD_UPSTREAM_MANIFEST_PATH);
    if (!value.isBlank()) {
      return value;
    }
    value = jsonSupport.text(summary, "upstream_manifest_path");
    if (!value.isBlank()) {
      return value;
    }
    JsonNode meta = latestArtifactPayload(job.getId(), ARTIFACT_DOMAIN_CANDIDATES);
    value = jsonSupport.text(meta, FIELD_UPSTREAM_MANIFEST_PATH);
    if (!value.isBlank()) {
      return value;
    }
    throw new BadRequestException(
        "REPLAY_UPSTREAM_MISSING", "Replay upstream manifest path가 없습니다.");
  }

  private JsonNode latestArtifactPayload(Long pipelineJobId, String artifactType) {
    return pipelineArtifactRepository
        .findByPipelineJobIdAndArtifactTypeOrderByCreatedAtDesc(pipelineJobId, artifactType)
        .stream()
        .findFirst()
        .map(artifact -> jsonSupport.readJson(artifact.getPayloadJson()))
        .orElse(jsonSupport.objectNode());
  }

  private String latestArtifactJsonOrNull(Long pipelineJobId, String artifactType) {
    return pipelineArtifactRepository
        .findByPipelineJobIdAndArtifactTypeOrderByCreatedAtDesc(pipelineJobId, artifactType)
        .stream()
        .findFirst()
        .map(PipelineArtifact::getPayloadJson)
        .orElse(null);
  }

  private String replaySummaryJson(
      String runMode,
      String upstreamManifestPath,
      String confirmedDomainProfileJson,
      String feedbackConstraintsJson) {
    ObjectNode summary = jsonSupport.objectNode();
    summary.put("runMode", runMode);
    summary.put(FIELD_UPSTREAM_MANIFEST_PATH, upstreamManifestPath);
    if (confirmedDomainProfileJson != null) {
      summary.set("confirmedDomainProfile", jsonSupport.readJson(confirmedDomainProfileJson));
    }
    if (feedbackConstraintsJson != null) {
      summary.set("feedbackConstraints", jsonSupport.readJson(feedbackConstraintsJson));
    }
    return jsonSupport.toJson(summary);
  }
}
