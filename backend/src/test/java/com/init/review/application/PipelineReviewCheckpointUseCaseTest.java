package com.init.review.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.pipelinejob.application.DomainPackGenerationTriggerCommand;
import com.init.pipelinejob.application.DomainPackGenerationTriggerPort;
import com.init.pipelinejob.application.DomainPackGenerationTriggerResult;
import com.init.pipelinejob.application.PipelineJobCallbackSupportService;
import com.init.pipelinejob.application.WorkspaceMembershipPort;
import com.init.pipelinejob.application.exception.AirflowTriggerFailedException;
import com.init.pipelinejob.domain.model.PipelineArtifact;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.model.WebhookReceipt;
import com.init.pipelinejob.domain.repository.PipelineArtifactRepository;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import com.init.pipelinejob.testfixture.PipelineJobFixtures;
import com.init.review.domain.model.ReviewDecision;
import com.init.review.domain.model.ReviewSession;
import com.init.review.domain.model.ReviewTask;
import com.init.review.domain.repository.ReviewDecisionRepository;
import com.init.review.domain.repository.ReviewSessionRepository;
import com.init.review.domain.repository.ReviewTaskRepository;
import com.init.review.testfixture.ReviewFixtures;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.QuotaExceededException;
import com.init.shared.application.quota.WorkspaceQuotaValidator;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("PipelineReviewCheckpointUseCase")
class PipelineReviewCheckpointUseCaseTest {

  private static final Clock CLOCK =
      Clock.fixed(Instant.parse("2026-06-01T01:00:00Z"), ZoneOffset.UTC);
  private static final OffsetDateTime NOW = OffsetDateTime.now(CLOCK);

  @Mock private PipelineJobRepository pipelineJobRepository;
  @Mock private PipelineArtifactRepository pipelineArtifactRepository;
  @Mock private ReviewSessionRepository reviewSessionRepository;
  @Mock private ReviewTaskRepository reviewTaskRepository;
  @Mock private ReviewDecisionRepository reviewDecisionRepository;
  @Mock private PipelineJobCallbackSupportService callbackSupportService;
  @Mock private PipelineJobFailurePersistenceService failurePersistenceService;
  @Mock private DomainPackGenerationTriggerPort triggerPort;
  @Mock private WorkspaceMembershipPort workspaceMembershipPort;
  @Mock private WorkspaceQuotaValidator workspaceQuotaValidator;

  private final ObjectMapper objectMapper = new ObjectMapper();
  private PipelineReviewCheckpointUseCase useCase;

  @BeforeEach
  void setUp() {
    PipelineReviewCheckpointJsonSupport jsonSupport =
        new PipelineReviewCheckpointJsonSupport(objectMapper);
    useCase =
        new PipelineReviewCheckpointUseCase(
            pipelineJobRepository,
            pipelineArtifactRepository,
            reviewSessionRepository,
            reviewTaskRepository,
            reviewDecisionRepository,
            new PipelineReviewCheckpointCallbackProcessor(
                pipelineJobRepository,
                pipelineArtifactRepository,
                reviewSessionRepository,
                reviewTaskRepository,
                callbackSupportService,
                new PipelineReviewTaskFactory(jsonSupport),
                jsonSupport),
            new PipelineReviewReplayOrchestrator(
                pipelineArtifactRepository,
                pipelineJobRepository,
                failurePersistenceService,
                triggerPort,
                jsonSupport,
                CLOCK),
            workspaceMembershipPort,
            workspaceQuotaValidator,
            jsonSupport,
            CLOCK);
  }

  @Test
  @DisplayName("domain checkpoint callback rejects missing artifact payload")
  void receiveDomainConfirmationCheckpoint_nullPayload_throwsBadRequestException() {
    PipelineJob job = job(PipelineJob.STATUS_RUNNING, "{}");
    WebhookReceipt receipt =
        WebhookReceipt.receive(
            7L,
            "evt-domain-null",
            PipelineReviewCheckpointUseCase.WEBHOOK_TYPE_DOMAIN_CONFIRMATION,
            "{}",
            "{}",
            NOW);

    given(pipelineJobRepository.findById(7L)).willReturn(Optional.of(job));
    given(callbackSupportService.findReceipt("evt-domain-null")).willReturn(Optional.empty());
    given(
            callbackSupportService.ensureReceivedReceipt(
                eq(7L),
                eq("evt-domain-null"),
                eq(PipelineReviewCheckpointUseCase.WEBHOOK_TYPE_DOMAIN_CONFIRMATION),
                eq("{}"),
                eq("{}"),
                eq(null)))
        .willReturn(receipt);
    given(callbackSupportService.now()).willReturn(NOW);
    given(
            callbackSupportService.executeInTransactionOrMarkFailure(
                eq(7L), eq("evt-domain-null"), any()))
        .willAnswer(invocation -> invocation.<Supplier<?>>getArgument(2).get());

    assertThatThrownBy(
            () ->
                useCase.receiveDomainConfirmationCheckpoint(
                    new PipelineReviewCheckpointUseCase.CheckpointCallbackCommand(
                        7L,
                        "secret",
                        "evt-domain-null",
                        "domain_pack_generation",
                        "run-1",
                        "INITIAL",
                        null,
                        "/artifacts/initial/manifest.json",
                        "/artifacts/domain_candidates.json",
                        objectMapper.nullNode(),
                        "{}",
                        "{}")))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("artifactPayload");
  }

  @Test
  @DisplayName("domain checkpoint callback creates review tasks and waits for confirmation")
  void receiveDomainConfirmationCheckpoint_createsSessionTasksAndWaitingStatus() throws Exception {
    PipelineJob job = job(PipelineJob.STATUS_RUNNING, "{}");
    JsonNode artifactPayload =
        objectMapper.readTree(
            """
            {
              "upstreamManifestPath": "/artifacts/initial/manifest.json",
              "candidates": [
                {
                  "candidateId": "card",
                  "displayName": "카드 상담",
                  "confidence": 0.91,
                  "priority": "HIGH"
                }
              ]
            }
            """);
    WebhookReceipt receipt =
        WebhookReceipt.receive(
            7L,
            "evt-domain",
            PipelineReviewCheckpointUseCase.WEBHOOK_TYPE_DOMAIN_CONFIRMATION,
            "{}",
            "{}",
            NOW);

    given(pipelineJobRepository.findById(7L)).willReturn(Optional.of(job));
    given(callbackSupportService.findReceipt("evt-domain")).willReturn(Optional.empty());
    given(
            callbackSupportService.ensureReceivedReceipt(
                eq(7L),
                eq("evt-domain"),
                eq(PipelineReviewCheckpointUseCase.WEBHOOK_TYPE_DOMAIN_CONFIRMATION),
                eq("{}"),
                eq("{}"),
                eq(null)))
        .willReturn(receipt);
    given(callbackSupportService.now()).willReturn(NOW);
    given(pipelineArtifactRepository.save(any(PipelineArtifact.class)))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(reviewSessionRepository.save(any(ReviewSession.class)))
        .willAnswer(
            invocation -> {
              ReviewSession session = invocation.getArgument(0);
              return ReviewFixtures.persisted(session, 55L);
            });
    given(callbackSupportService.executeInTransactionOrMarkFailure(eq(7L), eq("evt-domain"), any()))
        .willAnswer(invocation -> invocation.<Supplier<?>>getArgument(2).get());

    PipelineReviewCheckpointUseCase.CheckpointCallbackResult result =
        useCase.receiveDomainConfirmationCheckpoint(
            new PipelineReviewCheckpointUseCase.CheckpointCallbackCommand(
                7L,
                "secret",
                "evt-domain",
                "domain_pack_generation",
                "run-1",
                "INITIAL",
                null,
                "/artifacts/initial/manifest.json",
                "/artifacts/domain_candidates.json",
                artifactPayload,
                "{}",
                "{}"));

    ArgumentCaptor<Iterable<ReviewTask>> tasksCaptor = ArgumentCaptor.forClass(Iterable.class);
    verify(reviewTaskRepository).saveAll(tasksCaptor.capture());
    List<ReviewTask> tasks = toList(tasksCaptor.getValue());

    assertThat(result.status()).isEqualTo("CREATED");
    assertThat(job.getStatus()).isEqualTo(PipelineJob.STATUS_WAITING_DOMAIN_CONFIRMATION);
    assertThat(tasks).hasSize(1);
    assertThat(tasks.getFirst().getTargetType()).isEqualTo(ReviewTask.TARGET_DOMAIN_CANDIDATE);
    assertThat(tasks.getFirst().getTitle()).isEqualTo("카드 상담");
  }

  @Test
  @DisplayName("confirm domain writes profile artifact and triggers domain confirmed replay")
  void confirmDomain_writesProfileArtifactAndTriggersReplay() throws Exception {
    PipelineJob job =
        job(
            PipelineJob.STATUS_WAITING_DOMAIN_CONFIRMATION,
            "{\"upstreamManifestPath\":\"/artifacts/initial/manifest.json\"}");
    ReviewSession session =
        session(ReviewSession.KIND_DOMAIN_CONFIRMATION, ReviewSession.STATUS_OPEN, 55L);
    ReviewTask selected =
        task(
            101L,
            ReviewTask.TARGET_DOMAIN_CANDIDATE,
            """
            {
              "candidateId": "card",
              "displayName": "카드 상담",
              "confidence": 0.92,
              "evidenceTerms": ["분실", "한도"],
              "evidenceConversationIds": ["c1"],
              "suggestedDomainLexicon": ["카드", "결제"]
            }
            """);
    ReviewTask other = task(102L, ReviewTask.TARGET_DOMAIN_CANDIDATE, "{\"displayName\":\"기타\"}");

    givenReviewAccess(job);
    given(
            reviewSessionRepository.findFirstByPipelineJobIdAndReviewKindOrderByOpenedAtDesc(
                7L, ReviewSession.KIND_DOMAIN_CONFIRMATION))
        .willReturn(Optional.of(session));
    given(reviewTaskRepository.findById(101L)).willReturn(Optional.of(selected));
    given(reviewTaskRepository.findByReviewSessionIdOrderByIdAsc(55L))
        .willReturn(List.of(selected, other));
    given(reviewDecisionRepository.save(any(ReviewDecision.class)))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(pipelineArtifactRepository.save(any(PipelineArtifact.class)))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(triggerPort.trigger(any(DomainPackGenerationTriggerCommand.class)))
        .willReturn(new DomainPackGenerationTriggerResult("domain_pack_generation", "run-2"));

    PipelineReviewCheckpointUseCase.ReviewCheckpointResult result =
        useCase.confirmDomain(
            new PipelineReviewCheckpointUseCase.ConfirmDomainCommand(1L, 7L, 101L, 9L, "대표 도메인"));

    ArgumentCaptor<DomainPackGenerationTriggerCommand> triggerCaptor =
        ArgumentCaptor.forClass(DomainPackGenerationTriggerCommand.class);
    verify(triggerPort).trigger(triggerCaptor.capture());

    assertThat(result.status()).isEqualTo("DOMAIN_CONFIRMED_REPLAY_TRIGGERED");
    assertThat(session.getStatus()).isEqualTo(ReviewSession.STATUS_CLOSED);
    assertThat(selected.getStatus()).isEqualTo(ReviewTask.STATUS_RESOLVED);
    assertThat(other.getStatus()).isEqualTo(ReviewTask.STATUS_RESOLVED);
    assertThat(job.getStatus()).isEqualTo(PipelineJob.STATUS_RUNNING);
    assertThat(triggerCaptor.getValue().runMode()).isEqualTo("DOMAIN_CONFIRMED_REPLAY");
    assertThat(triggerCaptor.getValue().confirmedDomainProfileJson()).contains("카드 상담");
    assertThat(triggerCaptor.getValue().skipFeedbackCheckpoint()).isFalse();
  }

  @Test
  @DisplayName("시간당 도메인팩 작업 한도 초과 시 confirm domain은 replay 없이 차단된다")
  void confirmDomain_quotaExceeded_blocksBeforeMutation() {
    PipelineJob job = job(PipelineJob.STATUS_WAITING_DOMAIN_CONFIRMATION, "{}");
    givenReviewAccess(job);
    willThrow(new QuotaExceededException("DOMAIN_PACK_OPERATION", 1, 1))
        .given(workspaceQuotaValidator)
        .assertPipelineRunAllowed(1L);

    assertThatThrownBy(
            () ->
                useCase.confirmDomain(
                    new PipelineReviewCheckpointUseCase.ConfirmDomainCommand(
                        1L, 7L, 101L, 9L, "대표 도메인")))
        .isInstanceOf(QuotaExceededException.class);

    verify(triggerPort, never()).trigger(any(DomainPackGenerationTriggerCommand.class));
  }

  @Test
  @DisplayName("confirm domain persists failed job in a new transaction when replay trigger fails")
  void confirmDomain_replayTriggerFailure_marksParentJobFailed() throws Exception {
    PipelineJob job =
        job(
            PipelineJob.STATUS_WAITING_DOMAIN_CONFIRMATION,
            "{\"upstreamManifestPath\":\"/artifacts/initial/manifest.json\"}");
    ReviewSession session =
        session(ReviewSession.KIND_DOMAIN_CONFIRMATION, ReviewSession.STATUS_OPEN, 55L);
    ReviewTask selected =
        task(
            101L,
            ReviewTask.TARGET_DOMAIN_CANDIDATE,
            """
            {
              "candidateId": "card",
              "displayName": "카드 상담",
              "confidence": 0.92
            }
            """);

    givenReviewAccess(job);
    given(
            reviewSessionRepository.findFirstByPipelineJobIdAndReviewKindOrderByOpenedAtDesc(
                7L, ReviewSession.KIND_DOMAIN_CONFIRMATION))
        .willReturn(Optional.of(session));
    given(reviewTaskRepository.findById(101L)).willReturn(Optional.of(selected));
    given(reviewTaskRepository.findByReviewSessionIdOrderByIdAsc(55L))
        .willReturn(List.of(selected));
    given(reviewDecisionRepository.save(any(ReviewDecision.class)))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(pipelineArtifactRepository.save(any(PipelineArtifact.class)))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(triggerPort.trigger(any(DomainPackGenerationTriggerCommand.class)))
        .willThrow(new AirflowTriggerFailedException(7L, "airflow offline"));

    assertThatThrownBy(
            () ->
                useCase.confirmDomain(
                    new PipelineReviewCheckpointUseCase.ConfirmDomainCommand(
                        1L, 7L, 101L, 9L, "대표 도메인")))
        .isInstanceOf(AirflowTriggerFailedException.class);

    verify(failurePersistenceService).markFailed(eq(job), eq("airflow offline"), eq(NOW));
  }

  @Test
  @DisplayName("submit feedback writes constraints and triggers feedback replay with skip flag")
  void submitFeedback_writesConstraintsAndTriggersReplay() {
    PipelineJob job =
        job(
            PipelineJob.STATUS_WAITING_HUMAN_FEEDBACK,
            "{\"upstreamManifestPath\":\"/artifacts/domain-replay/manifest.json\"}");
    ReviewSession session =
        session(ReviewSession.KIND_HUMAN_FEEDBACK, ReviewSession.STATUS_OPEN, 56L);
    ReviewTask first =
        task(
            201L,
            ReviewTask.TARGET_FEEDBACK_PAIR,
            "{\"sourceId\":\"c1\",\"targetId\":\"c2\",\"questionText\":\"같은 업무인가?\"}");
    ReviewTask second =
        task(
            202L,
            ReviewTask.TARGET_FEEDBACK_PAIR,
            "{\"sourceId\":\"c3\",\"targetId\":\"c4\",\"questionText\":\"같은 업무인가?\"}");
    PipelineArtifact confirmedProfile =
        PipelineArtifact.create(
            7L,
            "domain_confirmation",
            "CONFIRMED_DOMAIN_PROFILE",
            null,
            null,
            "{\"domain\":\"card\"}",
            NOW);

    givenReviewAccess(job);
    given(
            reviewSessionRepository.findFirstByPipelineJobIdAndReviewKindOrderByOpenedAtDesc(
                7L, ReviewSession.KIND_HUMAN_FEEDBACK))
        .willReturn(Optional.of(session));
    given(reviewTaskRepository.findByReviewSessionIdOrderByIdAsc(56L))
        .willReturn(List.of(first, second));
    given(reviewDecisionRepository.save(any(ReviewDecision.class)))
        .willAnswer(
            invocation -> {
              ReviewDecision decision = invocation.getArgument(0);
              return ReviewFixtures.persisted(decision, 77L);
            });
    given(pipelineArtifactRepository.save(any(PipelineArtifact.class)))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(
            pipelineArtifactRepository.findByPipelineJobIdAndArtifactTypeOrderByCreatedAtDesc(
                7L, "CONFIRMED_DOMAIN_PROFILE"))
        .willReturn(List.of(confirmedProfile));
    given(triggerPort.trigger(any(DomainPackGenerationTriggerCommand.class)))
        .willReturn(new DomainPackGenerationTriggerResult("domain_pack_generation", "run-3"));

    PipelineReviewCheckpointUseCase.ReviewCheckpointResult result =
        useCase.submitFeedback(
            new PipelineReviewCheckpointUseCase.SubmitFeedbackCommand(
                1L,
                7L,
                9L,
                List.of(
                    new PipelineReviewCheckpointUseCase.FeedbackDecisionInput(
                        201L, "same", "같은 정지 업무"),
                    new PipelineReviewCheckpointUseCase.FeedbackDecisionInput(
                        202L, "different", "분리 필요"))));

    ArgumentCaptor<PipelineArtifact> artifactCaptor =
        ArgumentCaptor.forClass(PipelineArtifact.class);
    ArgumentCaptor<DomainPackGenerationTriggerCommand> triggerCaptor =
        ArgumentCaptor.forClass(DomainPackGenerationTriggerCommand.class);
    verify(pipelineArtifactRepository).save(artifactCaptor.capture());
    verify(triggerPort).trigger(triggerCaptor.capture());

    assertThat(result.status()).isEqualTo("FEEDBACK_REPLAY_TRIGGERED");
    assertThat(first.getStatus()).isEqualTo(ReviewTask.STATUS_RESOLVED);
    assertThat(second.getStatus()).isEqualTo(ReviewTask.STATUS_RESOLVED);
    assertThat(artifactCaptor.getValue().getPayloadJson())
        .contains("\"type\":\"must_link\"", "\"type\":\"cannot_link\"");
    assertThat(triggerCaptor.getValue().runMode()).isEqualTo("FEEDBACK_REPLAY");
    assertThat(triggerCaptor.getValue().skipFeedbackCheckpoint()).isTrue();
  }

  @Test
  @DisplayName("workflow boundary feedback emits workflow-scope and intent-scope constraints")
  void submitFeedback_workflowBoundaryFeedback_emitsWorkflowAndIntentConstraints()
      throws Exception {
    PipelineJob job =
        job(
            PipelineJob.STATUS_WAITING_HUMAN_FEEDBACK,
            "{\"upstreamManifestPath\":\"/artifacts/domain-replay/manifest.json\"}");
    ReviewSession session =
        session(ReviewSession.KIND_HUMAN_FEEDBACK, ReviewSession.STATUS_OPEN, 56L);
    ReviewTask workflowMerge =
        task(
            201L,
            ReviewTask.TARGET_FEEDBACK_PAIR,
            """
            {
              "sourceId": "wf1",
              "targetId": "wf2",
              "questionType": "WORKFLOW_BOUNDARY",
              "decisionScope": "workflow",
              "questionText": "같은 intent 안에서 두 상담을 같은 workflow로 합쳐도 되나요?",
              "answerOptions": [
                {"value": "same_workflow", "label": "같은 workflow로 합치기", "decisionScope": "workflow"},
                {"value": "different_intent", "label": "다른 intent로 분리", "decisionScope": "intent", "constraintType": "cannot_link"}
              ]
            }
            """);
    ReviewTask intentSplit =
        task(
            202L,
            ReviewTask.TARGET_FEEDBACK_PAIR,
            """
            {
              "sourceId": "wf3",
              "targetId": "wf4",
              "questionType": "WORKFLOW_BOUNDARY",
              "decisionScope": "workflow",
              "questionText": "같은 intent 안에서 두 상담을 같은 workflow로 합쳐도 되나요?",
              "answerOptions": [
                {"value": "same_workflow", "label": "같은 workflow로 합치기", "decisionScope": "workflow"},
                {"value": "different_intent", "label": "다른 intent로 분리", "decisionScope": "intent", "constraintType": "cannot_link"}
              ]
            }
            """);
    PipelineArtifact confirmedProfile =
        PipelineArtifact.create(
            7L,
            "domain_confirmation",
            "CONFIRMED_DOMAIN_PROFILE",
            null,
            null,
            "{\"domain\":\"card\"}",
            NOW);

    givenReviewAccess(job);
    given(
            reviewSessionRepository.findFirstByPipelineJobIdAndReviewKindOrderByOpenedAtDesc(
                7L, ReviewSession.KIND_HUMAN_FEEDBACK))
        .willReturn(Optional.of(session));
    given(reviewTaskRepository.findByReviewSessionIdOrderByIdAsc(56L))
        .willReturn(List.of(workflowMerge, intentSplit));
    given(reviewDecisionRepository.save(any(ReviewDecision.class)))
        .willAnswer(
            invocation -> {
              ReviewDecision decision = invocation.getArgument(0);
              return ReviewFixtures.persisted(decision, 77L);
            });
    given(pipelineArtifactRepository.save(any(PipelineArtifact.class)))
        .willAnswer(invocation -> invocation.getArgument(0));
    given(
            pipelineArtifactRepository.findByPipelineJobIdAndArtifactTypeOrderByCreatedAtDesc(
                7L, "CONFIRMED_DOMAIN_PROFILE"))
        .willReturn(List.of(confirmedProfile));
    given(triggerPort.trigger(any(DomainPackGenerationTriggerCommand.class)))
        .willReturn(new DomainPackGenerationTriggerResult("domain_pack_generation", "run-3"));

    useCase.submitFeedback(
        new PipelineReviewCheckpointUseCase.SubmitFeedbackCommand(
            1L,
            7L,
            9L,
            List.of(
                new PipelineReviewCheckpointUseCase.FeedbackDecisionInput(
                    201L, "same_workflow", "workflow 합치기"),
                new PipelineReviewCheckpointUseCase.FeedbackDecisionInput(
                    202L, "different_intent", "intent 분리"))));

    ArgumentCaptor<PipelineArtifact> artifactCaptor =
        ArgumentCaptor.forClass(PipelineArtifact.class);
    ArgumentCaptor<ReviewDecision> decisionCaptor = ArgumentCaptor.forClass(ReviewDecision.class);
    verify(pipelineArtifactRepository).save(artifactCaptor.capture());
    verify(reviewDecisionRepository, times(2)).save(decisionCaptor.capture());

    JsonNode constraints =
        objectMapper.readTree(artifactCaptor.getValue().getPayloadJson()).path("constraints");
    List<String> decisionPayloads =
        decisionCaptor.getAllValues().stream().map(ReviewDecision::getDecisionPayloadJson).toList();

    assertThat(constraints).hasSize(2);
    JsonNode workflowConstraint = constraintBySource(constraints, "wf1");
    assertThat(workflowConstraint.path("type").asText()).isEqualTo("same_workflow");
    assertThat(workflowConstraint.path("scope").asText()).isEqualTo("workflow");
    assertThat(workflowConstraint.path("targetId").asText()).isEqualTo("wf2");
    JsonNode intentConstraint = constraintBySource(constraints, "wf3");
    assertThat(intentConstraint.path("type").asText()).isEqualTo("cannot_link");
    assertThat(intentConstraint.path("scope").asText()).isEqualTo("intent");
    assertThat(intentConstraint.path("targetId").asText()).isEqualTo("wf4");
    assertThat(decisionPayloads.getFirst())
        .contains(
            "\"decisionType\":\"same_workflow\"",
            "\"decisionScope\":\"workflow\"",
            "\"questionType\":\"WORKFLOW_BOUNDARY\"");
    assertThat(decisionPayloads.get(1))
        .contains(
            "\"decisionType\":\"different_intent\"",
            "\"decisionScope\":\"intent\"",
            "\"constraintType\":\"cannot_link\"");
  }

  @Test
  @DisplayName("get checkpoint returns open review tasks for waiting job")
  void getCheckpoint_waitingJob_returnsReviewTasks() {
    PipelineJob job = job(PipelineJob.STATUS_WAITING_HUMAN_FEEDBACK, "{}");
    ReviewSession session =
        session(ReviewSession.KIND_HUMAN_FEEDBACK, ReviewSession.STATUS_OPEN, 56L);
    ReviewTask task =
        task(
            201L,
            ReviewTask.TARGET_FEEDBACK_PAIR,
            "{\"questionText\":\"이 두 상담은 같은 업무인가?\",\"priority\":\"HIGH\"}");

    givenReviewAccess(job);
    given(
            reviewSessionRepository.findFirstByPipelineJobIdAndReviewKindOrderByOpenedAtDesc(
                7L, ReviewSession.KIND_HUMAN_FEEDBACK))
        .willReturn(Optional.of(session));
    given(reviewTaskRepository.findByReviewSessionIdOrderByIdAsc(56L)).willReturn(List.of(task));

    PipelineReviewCheckpointUseCase.ReviewCheckpointView view = useCase.getCheckpoint(1L, 7L, 9L);

    assertThat(view.reviewKind()).isEqualTo(ReviewSession.KIND_HUMAN_FEEDBACK);
    assertThat(view.tasks()).hasSize(1);
    assertThat(view.tasks().getFirst().payload().path("questionText").asText())
        .isEqualTo("이 두 상담은 같은 업무인가?");
  }

  private static JsonNode constraintBySource(JsonNode constraints, String sourceId) {
    for (JsonNode constraint : constraints) {
      if (sourceId.equals(constraint.path("sourceId").asText())) {
        return constraint;
      }
    }
    throw new AssertionError("constraint not found for sourceId=" + sourceId);
  }

  private void givenReviewAccess(PipelineJob job) {
    given(pipelineJobRepository.findById(7L)).willReturn(Optional.of(job));
    given(workspaceMembershipPort.hasAnyRole(eq(1L), eq(9L), any(Set.class))).willReturn(true);
  }

  private PipelineJob job(String status, String summaryJson) {
    return PipelineJobFixtures.domainPackGeneration(7L)
        .workspaceId(1L)
        .datasetId(3L)
        .triggeredBy(9L)
        .status(status)
        .resultSummaryJson(summaryJson)
        .requestedAt(NOW.minusHours(1))
        .build();
  }

  private ReviewSession session(String reviewKind, String status, Long id) {
    ReviewSession session =
        ReviewSession.createPipelineCheckpoint(
            1L, 7L, 3L, reviewKind, "리뷰", "설명", "{}", NOW.minusMinutes(10));
    if (ReviewSession.STATUS_CLOSED.equals(status)) {
      session.close(NOW.minusMinutes(1));
    }
    return ReviewFixtures.persisted(session, id);
  }

  private ReviewTask task(Long id, String targetType, String payloadJson) {
    ReviewTask task =
        ReviewTask.create(
            id >= 200 ? 56L : 55L, targetType, payloadJson, "리뷰 태스크", "NORMAL", "{}", NOW);
    return ReviewFixtures.persisted(task, id);
  }

  private List<ReviewTask> toList(Iterable<ReviewTask> tasks) {
    if (tasks instanceof List<ReviewTask> list) {
      return list;
    }
    return List.of();
  }
}
