package com.init.review.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.pipelinejob.application.WorkspaceMembershipPort;
import com.init.pipelinejob.application.exception.PipelineJobWorkspaceAccessDeniedException;
import com.init.pipelinejob.domain.model.PipelineArtifact;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.repository.PipelineArtifactRepository;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import com.init.pipelinejob.testfixture.PipelineJobFixtures;
import com.init.shared.application.exception.NotFoundException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("PipelineReviewReplayDiffUseCase")
class PipelineReviewReplayDiffUseCaseTest {

  private static final OffsetDateTime BASE =
      OffsetDateTime.of(2026, 6, 1, 1, 0, 0, 0, ZoneOffset.UTC);

  @Mock private PipelineJobRepository pipelineJobRepository;
  @Mock private PipelineArtifactRepository pipelineArtifactRepository;
  @Mock private WorkspaceMembershipPort workspaceMembershipPort;

  private final ObjectMapper objectMapper = new ObjectMapper();
  private PipelineReviewReplayDiffUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase =
        new PipelineReviewReplayDiffUseCase(
            pipelineJobRepository,
            pipelineArtifactRepository,
            workspaceMembershipPort,
            new PipelineReviewCheckpointJsonSupport(objectMapper));
  }

  @Test
  @DisplayName("denies access when the user lacks a review role")
  void deniesWithoutRole() {
    PipelineJob job = job();
    given(pipelineJobRepository.findById(7L)).willReturn(Optional.of(job));
    given(workspaceMembershipPort.hasAnyRole(eq(1L), eq(9L), any(Set.class))).willReturn(false);

    assertThatThrownBy(() -> useCase.getReplayDiff(1L, 7L, 9L))
        .isInstanceOf(PipelineJobWorkspaceAccessDeniedException.class);
  }

  @Test
  @DisplayName("rejects job from another workspace")
  void rejectsForeignWorkspace() {
    PipelineJob job = job();
    given(pipelineJobRepository.findById(7L)).willReturn(Optional.of(job));

    assertThatThrownBy(() -> useCase.getReplayDiff(2L, 7L, 9L))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  @DisplayName("NOT_APPLICABLE when no feedback constraints exist")
  void notApplicableWithoutConstraints() {
    givenAccess();
    givenArtifacts("FEEDBACK_CONSTRAINTS", List.of());

    PipelineReviewReplayDiffUseCase.ReplayDiffView view = useCase.getReplayDiff(1L, 7L, 9L);

    assertThat(view.status()).isEqualTo("NOT_APPLICABLE");
    assertThat(view.available()).isFalse();
    assertThat(view.runMode()).isNull();
  }

  @Test
  @DisplayName("PENDING when the replay draft has not arrived after feedback")
  void pendingWhenDraftStale() {
    givenAccess();
    givenArtifacts(
        "FEEDBACK_CONSTRAINTS",
        List.of(artifact("FEEDBACK_CONSTRAINTS", "{}", BASE.plusMinutes(5))));
    givenArtifacts(
        "DOMAIN_PACK_DRAFT_PAYLOAD",
        List.of(artifact("DOMAIN_PACK_DRAFT_PAYLOAD", "{}", BASE.plusMinutes(1))));

    PipelineReviewReplayDiffUseCase.ReplayDiffView view = useCase.getReplayDiff(1L, 7L, 9L);

    assertThat(view.status()).isEqualTo("PENDING");
  }

  @Test
  @DisplayName("UNAVAILABLE when the draft carries no feedbackReplayDiff")
  void unavailableWhenDiffMissing() {
    givenAccess();
    givenArtifacts("FEEDBACK_CONSTRAINTS", List.of(artifact("FEEDBACK_CONSTRAINTS", "{}", BASE)));
    givenArtifacts(
        "DOMAIN_PACK_DRAFT_PAYLOAD",
        List.of(artifact("DOMAIN_PACK_DRAFT_PAYLOAD", "{\"packKey\":\"k\"}", BASE.plusMinutes(5))));

    PipelineReviewReplayDiffUseCase.ReplayDiffView view = useCase.getReplayDiff(1L, 7L, 9L);

    assertThat(view.status()).isEqualTo("UNAVAILABLE");
    assertThat(view.reason()).isEqualTo("diff_not_emitted");
  }

  @Test
  @DisplayName("UNAVAILABLE surfaces the ML reason when diff is unavailable")
  void unavailableCarriesReason() {
    givenAccess();
    givenArtifacts("FEEDBACK_CONSTRAINTS", List.of(artifact("FEEDBACK_CONSTRAINTS", "{}", BASE)));
    String payload =
        "{\"feedbackReplayDiff\":{\"available\":false,\"reason\":\"source_candidate_not_found\"}}";
    givenArtifacts(
        "DOMAIN_PACK_DRAFT_PAYLOAD",
        List.of(artifact("DOMAIN_PACK_DRAFT_PAYLOAD", payload, BASE.plusMinutes(5))));

    PipelineReviewReplayDiffUseCase.ReplayDiffView view = useCase.getReplayDiff(1L, 7L, 9L);

    assertThat(view.status()).isEqualTo("UNAVAILABLE");
    assertThat(view.reason()).isEqualTo("source_candidate_not_found");
  }

  @Test
  @DisplayName("READY maps structure diff, decisions, and summary")
  void readyMapsDiff() {
    givenAccess();
    givenArtifacts("FEEDBACK_CONSTRAINTS", List.of(artifact("FEEDBACK_CONSTRAINTS", "{}", BASE)));
    String diff =
        "{\"feedbackReplayDiff\":{"
            + "\"available\":true,\"structureComparisonAvailable\":true,"
            + "\"intent\":{\"splitCount\":1,\"mergeCount\":0,"
            + "\"labelChanges\":[{\"id\":\"10\",\"before\":\"카드\",\"after\":\"카드 분실\"}]},"
            + "\"workflow\":{\"splitCount\":0,\"mergeCount\":1,\"labelChanges\":[]},"
            + "\"decisions\":[{\"reviewTaskId\":\"11\",\"scope\":\"intent\",\"type\":\"must_link\","
            + "\"sourceId\":\"c1\",\"targetId\":\"c2\",\"status\":\"applied\",\"reason\":null}],"
            + "\"summary\":{\"applied\":1,\"partiallyApplied\":0,\"ignored\":0,\"total\":1}}}";
    givenArtifacts(
        "DOMAIN_PACK_DRAFT_PAYLOAD",
        List.of(artifact("DOMAIN_PACK_DRAFT_PAYLOAD", diff, BASE.plusMinutes(5))));

    PipelineReviewReplayDiffUseCase.ReplayDiffView view = useCase.getReplayDiff(1L, 7L, 9L);

    assertThat(view.status()).isEqualTo("READY");
    assertThat(view.available()).isTrue();
    assertThat(view.structureComparisonAvailable()).isTrue();
    assertThat(view.intent().splitCount()).isEqualTo(1);
    assertThat(view.intent().labelChanges()).singleElement();
    assertThat(view.intent().labelChanges().get(0).after()).isEqualTo("카드 분실");
    assertThat(view.workflow().mergeCount()).isEqualTo(1);
    assertThat(view.decisions()).singleElement();
    assertThat(view.decisions().get(0).reviewTaskId()).isEqualTo(11L);
    assertThat(view.decisions().get(0).status()).isEqualTo("applied");
    assertThat(view.summary().applied()).isEqualTo(1);
    assertThat(view.summary().total()).isEqualTo(1);
  }

  private void givenAccess() {
    PipelineJob job = job();
    given(pipelineJobRepository.findById(7L)).willReturn(Optional.of(job));
    given(workspaceMembershipPort.hasAnyRole(eq(1L), eq(9L), any(Set.class))).willReturn(true);
  }

  private void givenArtifacts(String artifactType, List<PipelineArtifact> artifacts) {
    given(
            pipelineArtifactRepository.findByPipelineJobIdAndArtifactTypeOrderByCreatedAtDesc(
                7L, artifactType))
        .willReturn(artifacts);
  }

  private PipelineArtifact artifact(String type, String payloadJson, OffsetDateTime createdAt) {
    return PipelineArtifact.create(7L, "human_feedback", type, null, null, payloadJson, createdAt);
  }

  private PipelineJob job() {
    return PipelineJobFixtures.domainPackGeneration(7L)
        .workspaceId(1L)
        .datasetId(3L)
        .triggeredBy(9L)
        .status(PipelineJob.STATUS_RUNNING)
        .requestedAt(BASE.minusHours(1))
        .build();
  }
}
