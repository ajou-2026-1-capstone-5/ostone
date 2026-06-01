package com.init.workflowruntime.application.matching;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.workflowruntime.infrastructure.persistence.WorkflowMatchingProfileBuildJdbcRepository;
import com.init.workflowruntime.infrastructure.persistence.WorkflowMatchingProfileJdbcRepository;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class WorkflowMatchingProfileBuildWorker {

  private static final Logger log =
      LoggerFactory.getLogger(WorkflowMatchingProfileBuildWorker.class);
  private static final String PROVIDER_BEDROCK = "bedrock";

  private final EmbeddingProperties properties;
  private final EmbeddingClient embeddingClient;
  private final WorkflowMatchingProfileBuildJdbcRepository buildRepository;
  private final WorkflowMatchingProfileJdbcRepository profileRepository;
  private final WorkflowDefinitionRepository workflowDefinitionRepository;
  private final IntentDefinitionRepository intentDefinitionRepository;
  private final WorkflowMatchingProfileTextFactory textFactory;
  private final ObjectMapper objectMapper;
  private final MeterRegistry meterRegistry;

  public WorkflowMatchingProfileBuildWorker(
      EmbeddingProperties properties,
      EmbeddingClient embeddingClient,
      WorkflowMatchingProfileBuildJdbcRepository buildRepository,
      WorkflowMatchingProfileJdbcRepository profileRepository,
      WorkflowDefinitionRepository workflowDefinitionRepository,
      IntentDefinitionRepository intentDefinitionRepository,
      WorkflowMatchingProfileTextFactory textFactory,
      ObjectMapper objectMapper,
      MeterRegistry meterRegistry) {
    this.properties = properties;
    this.embeddingClient = embeddingClient;
    this.buildRepository = buildRepository;
    this.profileRepository = profileRepository;
    this.workflowDefinitionRepository = workflowDefinitionRepository;
    this.intentDefinitionRepository = intentDefinitionRepository;
    this.textFactory = textFactory;
    this.objectMapper = objectMapper;
    this.meterRegistry = meterRegistry;
  }

  @Scheduled(fixedDelayString = "${app.ai.embedding.profile-build-interval:30s}")
  public void buildNextProfile() {
    if (!properties.enabled()) {
      return;
    }
    buildRepository.claimNext().ifPresent(this::buildJob);
  }

  private void buildJob(WorkflowMatchingProfileBuildJob job) {
    try {
      Map<Long, IntentDefinition> intentsById =
          intentDefinitionRepository.findByDomainPackVersionId(job.domainPackVersionId()).stream()
              .collect(Collectors.toMap(IntentDefinition::getId, Function.identity()));
      List<WorkflowDefinition> workflows =
          workflowDefinitionRepository.findAllByDomainPackVersionId(job.domainPackVersionId());
      List<WorkflowMatchingProfileWrite> profiles = new ArrayList<>();

      for (WorkflowDefinition workflow : workflows) {
        IntentDefinition intent = intentsById.get(workflow.getIntentDefinitionId());
        if (intent == null || IntentDefinition.STATUS_REJECTED.equals(intent.getStatus())) {
          continue;
        }
        String profileText = textFactory.build(intent, workflow);
        float[] embedding = embeddingClient.embed(profileText, EmbeddingInputType.SEARCH_DOCUMENT);
        String qualityJson = qualityJson(workflow);
        String sourceJson = sourceJson(intent, workflow, job.triggerType());
        profiles.add(
            new WorkflowMatchingProfileWrite(
                job.domainPackVersionId(),
                workflow.getId(),
                intent.getId(),
                job.profileVersion(),
                VectorUtils.sha256(profileText),
                profileText,
                VectorUtils.toVectorLiteral(embedding),
                PROVIDER_BEDROCK,
                properties.modelOrDefault(),
                properties.bedrockRegionOrDefault(),
                EmbeddingInputType.SEARCH_DOCUMENT.wireValue(),
                qualityJson,
                sourceJson));
      }

      profileRepository.replaceActiveProfileVersionAndMarkSucceeded(
          job.id(), job.domainPackVersionId(), job.profileVersion(), profiles);
      meterRegistry.counter("workflow_matching.profile_build", "status", "succeeded").increment();
    } catch (RuntimeException e) {
      log.warn("Workflow matching profile build failed: jobId={}", job.id(), e);
      buildRepository.markFailed(job.id(), errorJson(e));
      meterRegistry.counter("workflow_matching.profile_build", "status", "failed").increment();
    }
  }

  private String qualityJson(WorkflowDefinition workflow) {
    ObjectNode quality = objectMapper.createObjectNode();
    quality.put("isPrimary", Boolean.TRUE.equals(workflow.getIsPrimary()));
    quality.put("source", "workflow_definition");
    return quality.toString();
  }

  private String sourceJson(
      IntentDefinition intent, WorkflowDefinition workflow, String triggerType) {
    ObjectNode source = objectMapper.createObjectNode();
    source.put("triggerType", triggerType);
    source.put("intentCode", intent.getIntentCode());
    source.put("workflowCode", workflow.getWorkflowCode());
    return source.toString();
  }

  private String errorJson(RuntimeException e) {
    ObjectNode error = objectMapper.createObjectNode();
    error.put("type", e.getClass().getSimpleName());
    error.put("message", e.getMessage());
    return error.toString();
  }
}
