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
import java.time.OffsetDateTime;

@Entity
@Table(name = "simulation_feedback", schema = "runtime")
public class SimulationFeedback {

  private static final int TEXT_MAX_LENGTH = 2000;

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "workspace_id", nullable = false)
  private Long workspaceId;

  @Column(name = "chat_session_id", nullable = false)
  private Long chatSessionId;

  @Column(name = "chat_message_id")
  private Long chatMessageId;

  @Enumerated(EnumType.STRING)
  @Column(name = "feedback_type", nullable = false)
  private SimulationFeedbackType feedbackType;

  @Column(name = "description", nullable = false, columnDefinition = "TEXT")
  private String description;

  @Column(name = "expected_behavior", nullable = false, columnDefinition = "TEXT")
  private String expectedBehavior;

  @Enumerated(EnumType.STRING)
  @Column(name = "severity", nullable = false)
  private SimulationFeedbackSeverity severity;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false)
  private SimulationFeedbackStatus status;

  @Column(name = "created_by", nullable = false)
  private Long createdBy;

  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  protected SimulationFeedback() {
    // JPA constructor
  }

  public static SimulationFeedback create(
      Long workspaceId,
      Long chatSessionId,
      Long chatMessageId,
      SimulationFeedbackContent content,
      Long createdBy) {
    SimulationFeedback feedback = new SimulationFeedback();
    feedback.workspaceId = requireId(workspaceId, "workspaceId");
    feedback.chatSessionId = requireId(chatSessionId, "chatSessionId");
    feedback.chatMessageId = chatMessageId;
    SimulationFeedbackContent requiredContent = requireNonNull(content, "content");
    feedback.feedbackType = requireNonNull(requiredContent.feedbackType(), "feedbackType");
    feedback.description = normalizeText(requiredContent.description(), "description");
    feedback.expectedBehavior =
        normalizeText(requiredContent.expectedBehavior(), "expectedBehavior");
    feedback.severity = requireNonNull(requiredContent.severity(), "severity");
    feedback.status = SimulationFeedbackStatus.OPEN;
    feedback.createdBy = requireId(createdBy, "createdBy");
    return feedback;
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
      this.status = SimulationFeedbackStatus.OPEN;
    }
  }

  @PreUpdate
  protected void onUpdate() {
    this.updatedAt = OffsetDateTime.now();
  }

  public Long getId() {
    return id;
  }

  public Long getWorkspaceId() {
    return workspaceId;
  }

  public Long getChatSessionId() {
    return chatSessionId;
  }

  public Long getChatMessageId() {
    return chatMessageId;
  }

  public SimulationFeedbackType getFeedbackType() {
    return feedbackType;
  }

  public String getDescription() {
    return description;
  }

  public String getExpectedBehavior() {
    return expectedBehavior;
  }

  public SimulationFeedbackSeverity getSeverity() {
    return severity;
  }

  public SimulationFeedbackStatus getStatus() {
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

  public void markCandidateCreated() {
    if (this.status != SimulationFeedbackStatus.OPEN) {
      throw new InvalidSimulationFeedbackException(
          "candidate can only be created from OPEN feedback");
    }
    this.status = SimulationFeedbackStatus.CANDIDATE_CREATED;
  }

  public void markResolved() {
    if (this.status != SimulationFeedbackStatus.CANDIDATE_CREATED
        && this.status != SimulationFeedbackStatus.OPEN) {
      throw new InvalidSimulationFeedbackException(
          "feedback can only be resolved from OPEN or CANDIDATE_CREATED");
    }
    this.status = SimulationFeedbackStatus.RESOLVED;
  }

  public void markDismissed() {
    if (this.status != SimulationFeedbackStatus.CANDIDATE_CREATED
        && this.status != SimulationFeedbackStatus.OPEN) {
      throw new InvalidSimulationFeedbackException(
          "feedback can only be dismissed from OPEN or CANDIDATE_CREATED");
    }
    this.status = SimulationFeedbackStatus.DISMISSED;
  }

  private static Long requireId(Long value, String fieldName) {
    if (value == null) {
      throw new InvalidSimulationFeedbackException(fieldName + " must not be null");
    }
    return value;
  }

  private static <T> T requireNonNull(T value, String fieldName) {
    if (value == null) {
      throw new InvalidSimulationFeedbackException(fieldName + " must not be null");
    }
    return value;
  }

  private static String normalizeText(String value, String fieldName) {
    if (value == null || value.isBlank()) {
      throw new InvalidSimulationFeedbackException(fieldName + " must not be blank");
    }
    String normalized = value.trim();
    if (normalized.length() > TEXT_MAX_LENGTH) {
      throw new InvalidSimulationFeedbackException(
          fieldName + " must be at most " + TEXT_MAX_LENGTH);
    }
    return normalized;
  }
}
