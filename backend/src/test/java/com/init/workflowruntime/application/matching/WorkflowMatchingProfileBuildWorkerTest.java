package com.init.workflowruntime.application.matching;

import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.intentDefinitionWithId;
import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.workflowDefinitionWithId;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.workflowruntime.infrastructure.persistence.WorkflowMatchingProfileBuildJdbcRepository;
import com.init.workflowruntime.infrastructure.persistence.WorkflowMatchingProfileJdbcRepository;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("WorkflowMatchingProfileBuildWorker")
class WorkflowMatchingProfileBuildWorkerTest {

  @Mock private EmbeddingClient embeddingClient;
  @Mock private WorkflowMatchingProfileBuildJdbcRepository buildRepository;
  @Mock private WorkflowMatchingProfileJdbcRepository profileRepository;
  @Mock private WorkflowDefinitionRepository workflowDefinitionRepository;
  @Mock private IntentDefinitionRepository intentDefinitionRepository;

  private SimpleMeterRegistry meterRegistry;
  private WorkflowMatchingProfileBuildWorker worker;

  @BeforeEach
  void setUp() {
    meterRegistry = new SimpleMeterRegistry();
    worker =
        new WorkflowMatchingProfileBuildWorker(
            embeddingProperties(true),
            embeddingClient,
            buildRepository,
            profileRepository,
            workflowDefinitionRepository,
            intentDefinitionRepository,
            profileTextFactory(),
            new ObjectMapper(),
            meterRegistry);
  }

  @Test
  @DisplayName("enabled=false이면 build job을 claim하지 않는다")
  void should_skipClaim_when_embeddingDisabled() {
    worker =
        new WorkflowMatchingProfileBuildWorker(
            embeddingProperties(false),
            embeddingClient,
            buildRepository,
            profileRepository,
            workflowDefinitionRepository,
            intentDefinitionRepository,
            profileTextFactory(),
            new ObjectMapper(),
            meterRegistry);

    worker.buildNextProfile();

    verify(buildRepository, never()).claimNext();
  }

  @Test
  @DisplayName("published intent workflow만 embedding profile로 승격한다")
  void should_buildProfilesForPublishedIntentWorkflows() {
    WorkflowMatchingProfileBuildJob job =
        new WorkflowMatchingProfileBuildJob(7L, 101L, "DEPLOY", "profile-v2");
    IntentDefinition publishedIntent = intent(10L, "refund_request", "PUBLISHED");
    IntentDefinition rejectedIntent = intent(11L, "legacy_refund", "REJECTED");
    WorkflowDefinition publishedWorkflow = workflow(20L, 10L, "refund_flow", true);
    WorkflowDefinition rejectedWorkflow = workflow(21L, 11L, "legacy_refund_flow", false);
    given(buildRepository.claimNext()).willReturn(Optional.of(job));
    given(intentDefinitionRepository.findByDomainPackVersionId(101L))
        .willReturn(List.of(publishedIntent, rejectedIntent));
    given(workflowDefinitionRepository.findAllByDomainPackVersionId(101L))
        .willReturn(List.of(publishedWorkflow, rejectedWorkflow));
    given(embeddingClient.embed(any(), eq(EmbeddingInputType.SEARCH_DOCUMENT)))
        .willReturn(vector(1.0f, 0.0f));

    worker.buildNextProfile();

    @SuppressWarnings("unchecked")
    ArgumentCaptor<List<WorkflowMatchingProfileWrite>> profilesCaptor =
        ArgumentCaptor.forClass(List.class);
    verify(profileRepository)
        .replaceActiveProfileVersionAndMarkSucceeded(
            eq(7L), eq(101L), eq("profile-v2"), profilesCaptor.capture());
    List<WorkflowMatchingProfileWrite> profiles = profilesCaptor.getValue();
    assertThat(profiles).hasSize(1);
    assertThat(profiles.getFirst().workflowDefinitionId()).isEqualTo(20L);
    assertThat(profiles.getFirst().intentDefinitionId()).isEqualTo(10L);
    assertThat(profiles.getFirst().profileText()).contains("refund_request", "refund_flow");
    assertThat(profiles.getFirst().embeddingInputType()).isEqualTo("search_document");
    assertThat(profiles.getFirst().sourceJson()).contains("\"triggerType\":\"DEPLOY\"");
    assertThat(
            meterRegistry.counter("workflow_matching.profile_build", "status", "succeeded").count())
        .isEqualTo(1.0);
  }

  @Test
  @DisplayName("embedding 실패 시 job을 FAILED로 기록하고 실패 metric을 남긴다")
  void should_markFailed_when_embeddingFails() {
    WorkflowMatchingProfileBuildJob job =
        new WorkflowMatchingProfileBuildJob(7L, 101L, "DEPLOY", "profile-v2");
    IntentDefinition intent = intent(10L, "refund_request", "PUBLISHED");
    WorkflowDefinition workflow = workflow(20L, 10L, "refund_flow", true);
    given(buildRepository.claimNext()).willReturn(Optional.of(job));
    given(intentDefinitionRepository.findByDomainPackVersionId(101L)).willReturn(List.of(intent));
    given(workflowDefinitionRepository.findAllByDomainPackVersionId(101L))
        .willReturn(List.of(workflow));
    given(embeddingClient.embed(any(), eq(EmbeddingInputType.SEARCH_DOCUMENT)))
        .willThrow(new IllegalStateException("bedrock timeout"));

    worker.buildNextProfile();

    verify(buildRepository)
        .markFailed(eq(7L), org.mockito.ArgumentMatchers.contains("bedrock timeout"));
    verify(profileRepository, never())
        .replaceActiveProfileVersionAndMarkSucceeded(any(), any(), any(), any());
    assertThat(meterRegistry.counter("workflow_matching.profile_build", "status", "failed").count())
        .isEqualTo(1.0);
  }

  private IntentDefinition intent(Long id, String intentCode, String status) {
    IntentDefinition intent =
        IntentDefinition.create(
            101L,
            intentCode,
            intentCode,
            "테스트 intent",
            1,
            "{}",
            "{\"optionalTerms\":[\"환불\"]}",
            "[{\"customerPhrase\":\"환불하고 싶어요\"}]",
            "{}");
    intent.changeStatus(status);
    return intentDefinitionWithId(intent, id);
  }

  private WorkflowDefinition workflow(
      Long id, Long intentDefinitionId, String workflowCode, boolean primary) {
    WorkflowDefinition workflow =
        WorkflowDefinition.create(
            101L,
            workflowCode,
            workflowCode,
            "테스트 workflow",
            "{\"nodes\":[{\"id\":\"start\",\"label\":\"시작\"}]}",
            "start",
            "[]",
            "[{\"agentAction\":\"정책 확인\"}]",
            "{\"workflowReplayFitness\":0.90,\"workflowPrecision\":0.80}",
            intentDefinitionId,
            primary,
            "{\"optionalTerms\":[\"환불\"]}");
    return workflowDefinitionWithId(workflow, id);
  }

  private float[] vector(float first, float second) {
    float[] vector = new float[VectorUtils.COHERE_EMBEDDING_DIMENSION];
    vector[0] = first;
    vector[1] = second;
    return vector;
  }

  private EmbeddingProperties embeddingProperties(boolean enabled) {
    return new EmbeddingProperties(
        "bedrock",
        enabled,
        "cohere.embed-v4:0",
        "ap-northeast-2",
        Duration.ofSeconds(5),
        Duration.ofSeconds(30),
        Duration.ofMinutes(15),
        Duration.ofMinutes(5),
        30,
        0.70,
        0.72,
        0.55,
        0.10,
        0.65,
        0.50,
        0.30);
  }

  private WorkflowMatchingProfileTextFactory profileTextFactory() {
    return new WorkflowMatchingProfileTextFactory(
        new WorkflowMatchingJsonParser(new ObjectMapper(), meterRegistry));
  }
}
