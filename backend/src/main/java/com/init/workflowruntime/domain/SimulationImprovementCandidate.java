package com.init.workflowruntime.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.OffsetDateTime;

@Entity
@Table(
    name = "simulation_improvement_candidate",
    schema = "runtime",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_simulation_improvement_candidate_feedback",
            columnNames = "feedback_id"))
public class SimulationImprovementCandidate {

  private static final int SUMMARY_MAX_LENGTH = 2000;
  private static final int TARGET_KEY_MAX_LENGTH = 255;

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "workspace_id", nullable = false)
  private Long workspaceId;

  @Column(name = "domain_pack_version_id", nullable = false)
  private Long domainPackVersionId;

  @Column(name = "feedback_id", nullable = false)
  private Long feedbackId;

  @Column(name = "chat_session_id", nullable = false)
  private Long chatSessionId;

  @Column(name = "chat_message_id")
  private Long chatMessageId;

  @Enumerated(EnumType.STRING)
  @Column(name = "candidate_type", nullable = false)
  private SimulationImprovementCandidateType candidateType;

  @Enumerated(EnumType.STRING)
  @Column(name = "target_element_type", nullable = false)
  private SimulationImprovementCandidateTargetType targetElementType;

  @Column(name = "target_element_id")
  private Long targetElementId;

  @Column(name = "target_element_key")
  private String targetElementKey;

  @Column(name = "before_summary", nullable = false, columnDefinition = "TEXT")
  private String beforeSummary;

  @Column(name = "after_summary", nullable = false, columnDefinition = "TEXT")
  private String afterSummary;

  @Column(name = "evidence_summary", nullable = false, columnDefinition = "TEXT")
  private String evidenceSummary;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false)
  private SimulationImprovementCandidateStatus status;

  @Column(name = "created_by", nullable = false)
  private Long createdBy;

  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  protected SimulationImprovementCandidate() {
    // JPA constructor
  }

  public static SimulationImprovementCandidate create(
      Long workspaceId,
      Long domainPackVersionId,
      Long feedbackId,
      Long chatSessionId,
      Long chatMessageId,
      SimulationImprovementCandidateDraft draft,
      Long createdBy) {
    SimulationImprovementCandidate candidate = new SimulationImprovementCandidate();
    candidate.workspaceId = requireId(workspaceId, "workspaceId");
    candidate.domainPackVersionId = requireId(domainPackVersionId, "domainPackVersionId");
    candidate.feedbackId = requireId(feedbackId, "feedbackId");
    candidate.chatSessionId = requireId(chatSessionId, "chatSessionId");
    candidate.chatMessageId = chatMessageId;
    SimulationImprovementCandidateDraft requiredDraft = requireNonNull(draft, "draft");
    candidate.candidateType = requireNonNull(requiredDraft.candidateType(), "candidateType");
    candidate.targetElementType =
        requireNonNull(requiredDraft.targetElementType(), "targetElementType");
    candidate.targetElementId = requiredDraft.targetElementId();
    candidate.targetElementKey = normalizeOptionalText(requiredDraft.targetElementKey());
    if (candidate.targetElementKey != null
        && candidate.targetElementKey.length() > TARGET_KEY_MAX_LENGTH) {
      throw new InvalidSimulationImprovementCandidateException(
          "targetElementKey must be at most " + TARGET_KEY_MAX_LENGTH);
    }
    candidate.beforeSummary = normalizeSummary(requiredDraft.beforeSummary(), "beforeSummary");
    candidate.afterSummary = normalizeSummary(requiredDraft.afterSummary(), "afterSummary");
    candidate.evidenceSummary =
        normalizeSummary(requiredDraft.evidenceSummary(), "evidenceSummary");
    candidate.status = SimulationImprovementCandidateStatus.DRAFT;
    candidate.createdBy = requireId(createdBy, "createdBy");
    return candidate;
  }

  @PrePersist
  protected void onPersist() {
    OffsetDateTime now = OffsetDateTime.now();
    if (this.createdAt == null) {
      this.createdAt = now;
    }
    if (this.updatedAt == null) {
      this.updatedAt = now;
    }
    if (this.status == null) {
      this.status = SimulationImprovementCandidateStatus.DRAFT;
    }
  }

  @PreUpdate
  protected void onUpdate() {
    this.updatedAt = OffsetDateTime.now();
  }

  public void changeStatus(SimulationImprovementCandidateStatus nextStatus) {
    this.status = requireNonNull(nextStatus, "status");
  }

  public Long getId() {
    return id;
  }

  public Long getWorkspaceId() {
    return workspaceId;
  }

  public Long getDomainPackVersionId() {
    return domainPackVersionId;
  }

  public Long getFeedbackId() {
    return feedbackId;
  }

  public Long getChatSessionId() {
    return chatSessionId;
  }

  public Long getChatMessageId() {
    return chatMessageId;
  }

  public SimulationImprovementCandidateType getCandidateType() {
    return candidateType;
  }

  public SimulationImprovementCandidateTargetType getTargetElementType() {
    return targetElementType;
  }

  public Long getTargetElementId() {
    return targetElementId;
  }

  public String getTargetElementKey() {
    return targetElementKey;
  }

  public String getBeforeSummary() {
    return beforeSummary;
  }

  public String getAfterSummary() {
    return afterSummary;
  }

  public String getEvidenceSummary() {
    return evidenceSummary;
  }

  public SimulationImprovementCandidateStatus getStatus() {
    return status;
  }

  public Long getCreatedBy() {
    return createdBy;
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }

  public OffsetDateTime getUpdatedAt() {
    return updatedAt;
  }

  private static Long requireId(Long value, String fieldName) {
    if (value == null) {
      throw new InvalidSimulationImprovementCandidateException(fieldName + " must not be null");
    }
    return value;
  }

  private static <T> T requireNonNull(T value, String fieldName) {
    if (value == null) {
      throw new InvalidSimulationImprovementCandidateException(fieldName + " must not be null");
    }
    return value;
  }

  private static String normalizeSummary(String value, String fieldName) {
    String normalized = normalizeOptionalText(value);
    if (normalized == null) {
      throw new InvalidSimulationImprovementCandidateException(fieldName + " must not be blank");
    }
    if (normalized.length() > SUMMARY_MAX_LENGTH) {
      throw new InvalidSimulationImprovementCandidateException(
          fieldName + " must be at most " + SUMMARY_MAX_LENGTH);
    }
    return normalized;
  }

  private static String normalizeOptionalText(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    return value.trim();
  }
}
