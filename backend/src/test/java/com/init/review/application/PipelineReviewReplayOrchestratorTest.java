package com.init.review.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.pipelinejob.application.DomainPackGenerationTriggerCommand;
import com.init.pipelinejob.application.DomainPackGenerationTriggerPort;
import com.init.pipelinejob.application.DomainPackGenerationTriggerResult;
import com.init.pipelinejob.application.exception.AirflowTriggerFailedException;
import com.init.pipelinejob.domain.model.PipelineArtifact;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.repository.PipelineArtifactRepository;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import com.init.pipelinejob.testfixture.PipelineJobFixtures;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("PipelineReviewReplayOrchestrator")
class PipelineReviewReplayOrchestratorTest {

  private static final Clock CLOCK =
      Clock.fixed(Instant.parse("2026-06-01T01:00:00Z"), ZoneOffset.UTC);
  private static final OffsetDateTime NOW = OffsetDateTime.now(CLOCK);

  @Mock private PipelineArtifactRepository pipelineArtifactRepository;
  @Mock private PipelineJobRepository pipelineJobRepository;
  @Mock private PipelineJobFailurePersistenceService failurePersistenceService;
  @Mock private DomainPackGenerationTriggerPort triggerPort;

  private PipelineReviewReplayOrchestrator orchestrator;

  @BeforeEach
  void setUp() {
    orchestrator =
        new PipelineReviewReplayOrchestrator(
            pipelineArtifactRepository,
            pipelineJobRepository,
            failurePersistenceService,
            triggerPort,
            new PipelineReviewCheckpointJsonSupport(new ObjectMapper()),
            CLOCK);
  }

  @Test
  @DisplayName("domain confirmation replay는 trigger command를 만들고 parent job을 RUNNING으로 되돌린다")
  void triggerDomainConfirmedReplay_triggersAirflowAndMarksRunning() {
    PipelineJob job =
        job(
            PipelineJob.STATUS_WAITING_DOMAIN_CONFIRMATION,
            "{\"upstreamManifestPath\":\"/artifacts/initial/manifest.json\"}");
    given(triggerPort.trigger(any(DomainPackGenerationTriggerCommand.class)))
        .willReturn(new DomainPackGenerationTriggerResult("domain_pack_generation", "run-2"));

    orchestrator.triggerDomainConfirmedReplay(job, "{\"confirmedDomain\":\"카드 상담\"}");

    ArgumentCaptor<DomainPackGenerationTriggerCommand> triggerCaptor =
        ArgumentCaptor.forClass(DomainPackGenerationTriggerCommand.class);
    verify(triggerPort).trigger(triggerCaptor.capture());
    verify(pipelineJobRepository).saveAndFlush(job);

    assertThat(job.getStatus()).isEqualTo(PipelineJob.STATUS_RUNNING);
    assertThat(triggerCaptor.getValue().runMode()).isEqualTo("DOMAIN_CONFIRMED_REPLAY");
    assertThat(triggerCaptor.getValue().parentPipelineJobId()).isEqualTo(7L);
    assertThat(triggerCaptor.getValue().confirmedDomainProfileJson()).contains("카드 상담");
    assertThat(triggerCaptor.getValue().skipFeedbackCheckpoint()).isFalse();
  }

  @Test
  @DisplayName("feedback replay는 confirmed profile artifact를 함께 전달하고 feedback checkpoint를 건너뛴다")
  void triggerFeedbackReplay_usesConfirmedProfileArtifactAndSkipFlag() {
    PipelineJob job =
        job(
            PipelineJob.STATUS_WAITING_HUMAN_FEEDBACK,
            "{\"upstreamManifestPath\":\"/artifacts/domain-replay/manifest.json\"}");
    PipelineArtifact confirmedProfile =
        PipelineArtifact.create(
            7L,
            "domain_confirmation",
            "CONFIRMED_DOMAIN_PROFILE",
            null,
            null,
            "{\"confirmedDomain\":\"카드 상담\"}",
            NOW);

    given(
            pipelineArtifactRepository.findByPipelineJobIdAndArtifactTypeOrderByCreatedAtDesc(
                7L, "CONFIRMED_DOMAIN_PROFILE"))
        .willReturn(List.of(confirmedProfile));
    given(triggerPort.trigger(any(DomainPackGenerationTriggerCommand.class)))
        .willReturn(new DomainPackGenerationTriggerResult("domain_pack_generation", "run-3"));

    orchestrator.triggerFeedbackReplay(job, "{\"constraints\":[]}");

    ArgumentCaptor<DomainPackGenerationTriggerCommand> triggerCaptor =
        ArgumentCaptor.forClass(DomainPackGenerationTriggerCommand.class);
    verify(triggerPort).trigger(triggerCaptor.capture());

    assertThat(triggerCaptor.getValue().runMode()).isEqualTo("FEEDBACK_REPLAY");
    assertThat(triggerCaptor.getValue().confirmedDomainProfileJson()).contains("카드 상담");
    assertThat(triggerCaptor.getValue().feedbackConstraintsJson()).contains("constraints");
    assertThat(triggerCaptor.getValue().skipFeedbackCheckpoint()).isTrue();
  }

  @Test
  @DisplayName("Airflow replay trigger 실패 시 parent job 실패 persistence에 위임한다")
  void triggerDomainConfirmedReplay_triggerFailure_marksParentJobFailed() {
    PipelineJob job =
        job(
            PipelineJob.STATUS_WAITING_DOMAIN_CONFIRMATION,
            "{\"upstreamManifestPath\":\"/artifacts/initial/manifest.json\"}");
    given(triggerPort.trigger(any(DomainPackGenerationTriggerCommand.class)))
        .willThrow(new AirflowTriggerFailedException(7L, "airflow offline"));

    assertThatThrownBy(
            () -> orchestrator.triggerDomainConfirmedReplay(job, "{\"confirmedDomain\":\"카드 상담\"}"))
        .isInstanceOf(AirflowTriggerFailedException.class);

    verify(failurePersistenceService).markFailed(eq(job), eq("airflow offline"), eq(NOW));
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
}
