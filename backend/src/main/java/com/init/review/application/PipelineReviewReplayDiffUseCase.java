package com.init.review.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.init.pipelinejob.application.WorkspaceMembershipPort;
import com.init.pipelinejob.application.exception.PipelineJobNotFoundException;
import com.init.pipelinejob.application.exception.PipelineJobWorkspaceAccessDeniedException;
import com.init.pipelinejob.domain.model.PipelineArtifact;
import com.init.pipelinejob.domain.model.PipelineJob;
import com.init.pipelinejob.domain.repository.PipelineArtifactRepository;
import com.init.pipelinejob.domain.repository.PipelineJobRepository;
import com.init.shared.application.exception.NotFoundException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * feedback replay 전후 구조 diff를 review 화면에 노출한다.
 *
 * <p>backend는 intent/flow 중간 산출물을 직접 보지 못하므로, ML이 evaluation 단계에서 계산해 domain-pack 콜백으로 전달한 {@code
 * feedbackReplayDiff}를 {@code DOMAIN_PACK_DRAFT_PAYLOAD} artifact에서 읽는다. diff 미존재/진행 중/replay 아님을
 * 명시적으로 구분해 draft 성공으로 오인하지 않게 한다.
 */
@Service
@Transactional(readOnly = true)
public class PipelineReviewReplayDiffUseCase {

  private static final String ARTIFACT_FEEDBACK_CONSTRAINTS = "FEEDBACK_CONSTRAINTS";
  private static final String ARTIFACT_DOMAIN_PACK_DRAFT_PAYLOAD = "DOMAIN_PACK_DRAFT_PAYLOAD";
  private static final String FIELD_FEEDBACK_REPLAY_DIFF = "feedbackReplayDiff";
  private static final String RUN_MODE_FEEDBACK_REPLAY = "FEEDBACK_REPLAY";

  private static final String STATUS_READY = "READY";
  private static final String STATUS_PENDING = "PENDING";
  private static final String STATUS_UNAVAILABLE = "UNAVAILABLE";
  private static final String STATUS_NOT_APPLICABLE = "NOT_APPLICABLE";
  private static final String REASON_DIFF_NOT_EMITTED = "diff_not_emitted";

  private static final Set<String> ALLOWED_REVIEW_ROLES = Set.of("OWNER", "ADMIN", "OPERATOR");

  private final PipelineJobRepository pipelineJobRepository;
  private final PipelineArtifactRepository pipelineArtifactRepository;
  private final WorkspaceMembershipPort workspaceMembershipPort;
  private final PipelineReviewCheckpointJsonSupport jsonSupport;

  public PipelineReviewReplayDiffUseCase(
      PipelineJobRepository pipelineJobRepository,
      PipelineArtifactRepository pipelineArtifactRepository,
      WorkspaceMembershipPort workspaceMembershipPort,
      PipelineReviewCheckpointJsonSupport jsonSupport) {
    this.pipelineJobRepository = pipelineJobRepository;
    this.pipelineArtifactRepository = pipelineArtifactRepository;
    this.workspaceMembershipPort = workspaceMembershipPort;
    this.jsonSupport = jsonSupport;
  }

  public ReplayDiffView getReplayDiff(Long workspaceId, Long pipelineJobId, Long userId) {
    authorize(workspaceId, pipelineJobId, userId);

    Optional<PipelineArtifact> constraints =
        latestArtifact(pipelineJobId, ARTIFACT_FEEDBACK_CONSTRAINTS);
    if (constraints.isEmpty()) {
      return unavailableView(STATUS_NOT_APPLICABLE, null);
    }
    Optional<PipelineArtifact> draft =
        latestArtifact(pipelineJobId, ARTIFACT_DOMAIN_PACK_DRAFT_PAYLOAD);
    if (draft.isEmpty() || isBefore(draft.get().getCreatedAt(), constraints.get().getCreatedAt())) {
      return unavailableView(STATUS_PENDING, null);
    }
    JsonNode diff =
        jsonSupport.readJson(draft.get().getPayloadJson()).path(FIELD_FEEDBACK_REPLAY_DIFF);
    if (diff.isMissingNode() || diff.isNull()) {
      return unavailableView(STATUS_UNAVAILABLE, REASON_DIFF_NOT_EMITTED);
    }
    if (!diff.path("available").asBoolean(false)) {
      return unavailableView(STATUS_UNAVAILABLE, jsonSupport.text(diff, "reason"));
    }
    return readyView(diff);
  }

  private void authorize(Long workspaceId, Long pipelineJobId, Long userId) {
    PipelineJob job =
        pipelineJobRepository
            .findById(pipelineJobId)
            .orElseThrow(() -> new PipelineJobNotFoundException(pipelineJobId));
    if (!workspaceId.equals(job.getWorkspaceId())) {
      // 보안: 다른 workspace의 job 존재 여부가 노출되지 않도록 일반 not-found로 응답한다.
      throw new NotFoundException("PIPELINE_JOB_NOT_FOUND", "Pipeline job을 찾을 수 없습니다.");
    }
    if (!workspaceMembershipPort.hasAnyRole(workspaceId, userId, ALLOWED_REVIEW_ROLES)) {
      throw new PipelineJobWorkspaceAccessDeniedException(
          "Pipeline review checkpoint 접근 권한이 없습니다.");
    }
  }

  private Optional<PipelineArtifact> latestArtifact(Long pipelineJobId, String artifactType) {
    return pipelineArtifactRepository
        .findByPipelineJobIdAndArtifactTypeOrderByCreatedAtDesc(pipelineJobId, artifactType)
        .stream()
        .findFirst();
  }

  private boolean isBefore(OffsetDateTime left, OffsetDateTime right) {
    if (left == null || right == null) {
      return false;
    }
    return left.isBefore(right);
  }

  private ReplayDiffView unavailableView(String status, String reason) {
    String runMode = STATUS_NOT_APPLICABLE.equals(status) ? null : RUN_MODE_FEEDBACK_REPLAY;
    return new ReplayDiffView(
        false,
        runMode,
        status,
        reason,
        false,
        emptyStructure(),
        emptyStructure(),
        List.of(),
        new DiffSummary(0, 0, 0, 0));
  }

  private ReplayDiffView readyView(JsonNode diff) {
    return new ReplayDiffView(
        true,
        RUN_MODE_FEEDBACK_REPLAY,
        STATUS_READY,
        null,
        diff.path("structureComparisonAvailable").asBoolean(false),
        structureDiff(diff.path("intent")),
        structureDiff(diff.path("workflow")),
        decisions(diff.path("decisions")),
        summary(diff.path("summary")));
  }

  private StructureDiff structureDiff(JsonNode node) {
    if (!node.isObject()) {
      return emptyStructure();
    }
    List<LabelChange> labelChanges = new ArrayList<>();
    for (JsonNode change : node.path("labelChanges")) {
      labelChanges.add(
          new LabelChange(
              jsonSupport.text(change, "id"),
              jsonSupport.text(change, "before"),
              jsonSupport.text(change, "after")));
    }
    return new StructureDiff(
        node.path("splitCount").asInt(0), node.path("mergeCount").asInt(0), labelChanges);
  }

  private List<DecisionResult> decisions(JsonNode node) {
    List<DecisionResult> decisions = new ArrayList<>();
    if (!node.isArray()) {
      return decisions;
    }
    for (JsonNode item : node) {
      decisions.add(
          new DecisionResult(
              parseLong(jsonSupport.text(item, "reviewTaskId")),
              emptyToNull(jsonSupport.text(item, "scope")),
              emptyToNull(jsonSupport.text(item, "type")),
              emptyToNull(jsonSupport.text(item, "sourceId")),
              emptyToNull(jsonSupport.text(item, "targetId")),
              emptyToNull(jsonSupport.text(item, "status")),
              emptyToNull(jsonSupport.text(item, "reason")),
              emptyToNull(jsonSupport.text(item, "effect"))));
    }
    return decisions;
  }

  private DiffSummary summary(JsonNode node) {
    return new DiffSummary(
        node.path("applied").asInt(0),
        node.path("partiallyApplied").asInt(0),
        node.path("ignored").asInt(0),
        node.path("total").asInt(0));
  }

  private StructureDiff emptyStructure() {
    return new StructureDiff(0, 0, List.of());
  }

  private Long parseLong(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    try {
      return Long.parseLong(value.trim());
    } catch (NumberFormatException ex) {
      return null;
    }
  }

  private String emptyToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }

  public record ReplayDiffView(
      boolean available,
      String runMode,
      String status,
      String reason,
      boolean structureComparisonAvailable,
      StructureDiff intent,
      StructureDiff workflow,
      List<DecisionResult> decisions,
      DiffSummary summary) {}

  public record StructureDiff(int splitCount, int mergeCount, List<LabelChange> labelChanges) {}

  public record LabelChange(String id, String before, String after) {}

  public record DecisionResult(
      Long reviewTaskId,
      String scope,
      String decisionType,
      String sourceId,
      String targetId,
      String status,
      String reason,
      String effect) {}

  public record DiffSummary(int applied, int partiallyApplied, int ignored, int total) {}
}
