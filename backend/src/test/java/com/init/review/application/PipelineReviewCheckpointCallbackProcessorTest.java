package com.init.review.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.pipelinejob.application.PipelineJobCallbackSupportService;
import com.init.pipelinejob.domain.model.PipelineArtifact;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.model.WebhookReceipt;
import com.init.pipelinejob.domain.repository.PipelineArtifactRepository;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import com.init.pipelinejob.testfixture.PipelineJobFixtures;
import com.init.review.domain.model.ReviewSession;
import com.init.review.domain.model.ReviewTask;
import com.init.review.domain.repository.ReviewSessionRepository;
import com.init.review.domain.repository.ReviewTaskRepository;
import com.init.review.testfixture.ReviewFixtures;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("PipelineReviewCheckpointCallbackProcessor")
class PipelineReviewCheckpointCallbackProcessorTest {

  private static final OffsetDateTime NOW = OffsetDateTime.parse("2026-06-01T01:00:00Z");

  @Mock private PipelineJobRepository pipelineJobRepository;
  @Mock private PipelineArtifactRepository pipelineArtifactRepository;
  @Mock private ReviewSessionRepository reviewSessionRepository;
  @Mock private ReviewTaskRepository reviewTaskRepository;
  @Mock private PipelineJobCallbackSupportService callbackSupportService;

  private final ObjectMapper objectMapper = new ObjectMapper();
  private PipelineReviewCheckpointCallbackProcessor processor;

  @BeforeEach
  void setUp() {
    PipelineReviewCheckpointJsonSupport jsonSupport =
        new PipelineReviewCheckpointJsonSupport(objectMapper);
    processor =
        new PipelineReviewCheckpointCallbackProcessor(
            pipelineJobRepository,
            pipelineArtifactRepository,
            reviewSessionRepository,
            reviewTaskRepository,
            callbackSupportService,
            new PipelineReviewTaskFactory(jsonSupport),
            jsonSupport);
  }

  @Test
  @DisplayName("processed receipt가 있는 duplicate callback은 상태를 변경하지 않는다")
  void receiveCheckpoint_processedReceipt_returnsDuplicateIgnoredWithoutMutation() {
    WebhookReceipt receipt =
        WebhookReceipt.receive(
            7L,
            "evt-dup",
            PipelineReviewCheckpointUseCase.WEBHOOK_TYPE_DOMAIN_CONFIRMATION,
            "{}",
            "{}",
            NOW);
    receipt.markProcessed(NOW);

    given(callbackSupportService.findReceipt("evt-dup")).willReturn(Optional.of(receipt));
    given(callbackSupportService.isProcessed(receipt)).willReturn(true);

    PipelineReviewCheckpointUseCase.CheckpointCallbackResult result =
        processor.receiveDomainConfirmationCheckpoint(
            command("evt-dup", "domain_pack_generation", "run-1", objectMapper.createObjectNode()));

    assertThat(result.status()).isEqualTo("DUPLICATE_IGNORED");
    verify(pipelineJobRepository, never()).findById(any());
    verify(pipelineArtifactRepository, never()).save(any(PipelineArtifact.class));
    verify(reviewSessionRepository, never()).save(any(ReviewSession.class));
    verify(reviewTaskRepository, never()).saveAll(any());
  }

  @Test
  @DisplayName("human feedback callback은 feedback task를 만들고 job을 feedback 대기로 전환한다")
  void receiveHumanFeedbackCheckpoint_createsFeedbackTasksAndWaitingStatus() throws Exception {
    PipelineJob job = job(PipelineJob.STATUS_RUNNING);
    JsonNode payload =
        objectMapper.readTree(
            """
            {
              "upstreamManifestPath": "/artifacts/domain-replay/manifest.json",
              "questions": [
                {"sourceId": "c1", "targetId": "c2", "questionText": "같은 업무인가?"}
              ]
            }
            """);
    WebhookReceipt receipt =
        WebhookReceipt.receive(
            7L,
            "evt-feedback",
            PipelineReviewCheckpointUseCase.WEBHOOK_TYPE_HUMAN_FEEDBACK,
            "{}",
            "{}",
            NOW);

    given(pipelineJobRepository.findById(7L)).willReturn(Optional.of(job));
    given(callbackSupportService.findReceipt("evt-feedback")).willReturn(Optional.empty());
    given(
            callbackSupportService.ensureReceivedReceipt(
                eq(7L),
                eq("evt-feedback"),
                eq(PipelineReviewCheckpointUseCase.WEBHOOK_TYPE_HUMAN_FEEDBACK),
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
              return ReviewFixtures.persisted(session, 56L);
            });
    given(
            callbackSupportService.executeInTransactionOrMarkFailure(
                eq(7L), eq("evt-feedback"), any()))
        .willAnswer(invocation -> invocation.<Supplier<?>>getArgument(2).get());

    PipelineReviewCheckpointUseCase.CheckpointCallbackResult result =
        processor.receiveHumanFeedbackCheckpoint(
            command("evt-feedback", "domain_pack_generation", "run-2", payload));

    ArgumentCaptor<Iterable<ReviewTask>> tasksCaptor = ArgumentCaptor.forClass(Iterable.class);
    verify(reviewTaskRepository).saveAll(tasksCaptor.capture());
    List<ReviewTask> tasks = toList(tasksCaptor.getValue());

    assertThat(result.status()).isEqualTo("CREATED");
    assertThat(job.getStatus()).isEqualTo(PipelineJob.STATUS_WAITING_HUMAN_FEEDBACK);
    assertThat(tasks).hasSize(1);
    assertThat(tasks.getFirst().getTargetType()).isEqualTo(ReviewTask.TARGET_FEEDBACK_PAIR);
    assertThat(tasks.getFirst().getTitle()).isEqualTo("같은 업무인가?");
  }

  private PipelineReviewCheckpointUseCase.CheckpointCallbackCommand command(
      String eventId, String dagId, String dagRunId, JsonNode artifactPayload) {
    return new PipelineReviewCheckpointUseCase.CheckpointCallbackCommand(
        7L,
        "secret",
        eventId,
        dagId,
        dagRunId,
        "REPLAY",
        null,
        "/artifacts/domain-replay/manifest.json",
        "/artifacts/feedback_questions.json",
        artifactPayload,
        "{}",
        "{}");
  }

  private PipelineJob job(String status) {
    return PipelineJobFixtures.domainPackGeneration(7L)
        .workspaceId(1L)
        .datasetId(3L)
        .triggeredBy(9L)
        .status(status)
        .requestedAt(NOW.minusHours(1))
        .build();
  }

  private List<ReviewTask> toList(Iterable<ReviewTask> tasks) {
    if (tasks instanceof List<ReviewTask> list) {
      return list;
    }
    return List.of();
  }
}
