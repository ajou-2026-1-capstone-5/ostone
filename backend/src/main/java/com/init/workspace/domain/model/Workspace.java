package com.init.workspace.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
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
@Table(name = "workspace", schema = "app")
public class Workspace {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Embedded private WorkspaceKey workspaceKey;

  @Column(nullable = false)
  private String name;

  @Column private String description;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private WorkspaceStatus status;

  @Enumerated(EnumType.STRING)
  @Column(name = "free_onboarding_status", nullable = false)
  private FreeOnboardingStatus freeOnboardingStatus = FreeOnboardingStatus.AVAILABLE;

  @Column(name = "free_onboarding_dataset_id")
  private Long freeOnboardingDatasetId;

  @Column(name = "free_onboarding_pipeline_job_id")
  private Long freeOnboardingPipelineJobId;

  @Column(name = "free_onboarding_started_at")
  private OffsetDateTime freeOnboardingStartedAt;

  @Column(name = "free_onboarding_consumed_at")
  private OffsetDateTime freeOnboardingConsumedAt;

  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  protected Workspace() {}

  public static Workspace create(WorkspaceKey workspaceKey, String name, String description) {
    if (workspaceKey == null) {
      throw new IllegalArgumentException("workspaceKey must not be null");
    }
    validateName(name);
    validateDescription(description);

    Workspace workspace = new Workspace();
    workspace.workspaceKey = workspaceKey;
    workspace.name = name;
    workspace.description = description;
    workspace.status = WorkspaceStatus.ACTIVE;
    workspace.freeOnboardingStatus = FreeOnboardingStatus.AVAILABLE;
    return workspace;
  }

  public void update(String name, String description) {
    validateName(name);
    validateDescription(description);
    this.name = name;
    this.description = description;
  }

  public void archive() {
    if (status == WorkspaceStatus.ARCHIVED) {
      throw new IllegalStateException("이미 보관된 워크스페이스입니다.");
    }
    this.status = WorkspaceStatus.ARCHIVED;
  }

  public boolean canStartFreeOnboarding() {
    return getFreeOnboardingStatus() == FreeOnboardingStatus.AVAILABLE;
  }

  public boolean isFreeOnboardingInProgressForDataset(Long datasetId) {
    return getFreeOnboardingStatus() == FreeOnboardingStatus.IN_PROGRESS
        && freeOnboardingDatasetId != null
        && freeOnboardingDatasetId.equals(datasetId);
  }

  public void startFreeOnboarding(Long datasetId, OffsetDateTime startedAt) {
    if (datasetId == null) {
      throw new IllegalArgumentException("datasetId must not be null");
    }
    if (startedAt == null) {
      throw new IllegalArgumentException("startedAt must not be null");
    }
    if (!canStartFreeOnboarding()) {
      throw new IllegalStateException("무료 온보딩을 시작할 수 없는 상태입니다: " + getFreeOnboardingStatus());
    }
    this.freeOnboardingStatus = FreeOnboardingStatus.IN_PROGRESS;
    this.freeOnboardingDatasetId = datasetId;
    this.freeOnboardingPipelineJobId = null;
    this.freeOnboardingStartedAt = startedAt;
    this.freeOnboardingConsumedAt = null;
  }

  public void attachFreeOnboardingPipelineJob(Long datasetId, Long pipelineJobId) {
    if (datasetId == null) {
      throw new IllegalArgumentException("datasetId must not be null");
    }
    if (pipelineJobId == null) {
      throw new IllegalArgumentException("pipelineJobId must not be null");
    }
    if (!isFreeOnboardingInProgressForDataset(datasetId)) {
      throw new IllegalStateException("무료 온보딩 대상 dataset이 아닙니다.");
    }
    if (freeOnboardingPipelineJobId != null && !freeOnboardingPipelineJobId.equals(pipelineJobId)) {
      throw new IllegalStateException("무료 온보딩 pipeline job이 이미 연결되어 있습니다.");
    }
    this.freeOnboardingPipelineJobId = pipelineJobId;
  }

  public boolean consumeFreeOnboarding(Long pipelineJobId, OffsetDateTime consumedAt) {
    if (pipelineJobId == null) {
      return false;
    }
    if (consumedAt == null) {
      throw new IllegalArgumentException("consumedAt must not be null");
    }
    if (getFreeOnboardingStatus() == FreeOnboardingStatus.CONSUMED) {
      return false;
    }
    if (getFreeOnboardingStatus() != FreeOnboardingStatus.IN_PROGRESS
        || freeOnboardingPipelineJobId == null
        || !freeOnboardingPipelineJobId.equals(pipelineJobId)) {
      return false;
    }
    this.freeOnboardingStatus = FreeOnboardingStatus.CONSUMED;
    this.freeOnboardingConsumedAt = consumedAt;
    return true;
  }

  public void restoreFreeOnboarding() {
    this.freeOnboardingStatus = FreeOnboardingStatus.AVAILABLE;
    this.freeOnboardingDatasetId = null;
    this.freeOnboardingPipelineJobId = null;
    this.freeOnboardingStartedAt = null;
    this.freeOnboardingConsumedAt = null;
  }

  @PrePersist
  protected void onPersist() {
    OffsetDateTime now = OffsetDateTime.now();
    this.createdAt = now;
    this.updatedAt = now;
  }

  @PreUpdate
  protected void onUpdate() {
    this.updatedAt = OffsetDateTime.now();
  }

  public Long getId() {
    return id;
  }

  public WorkspaceKey getWorkspaceKey() {
    return workspaceKey;
  }

  public String getName() {
    return name;
  }

  public String getDescription() {
    return description;
  }

  public WorkspaceStatus getStatus() {
    return status;
  }

  public FreeOnboardingStatus getFreeOnboardingStatus() {
    return freeOnboardingStatus != null ? freeOnboardingStatus : FreeOnboardingStatus.AVAILABLE;
  }

  public Long getFreeOnboardingDatasetId() {
    return freeOnboardingDatasetId;
  }

  public Long getFreeOnboardingPipelineJobId() {
    return freeOnboardingPipelineJobId;
  }

  public OffsetDateTime getFreeOnboardingStartedAt() {
    return freeOnboardingStartedAt;
  }

  public OffsetDateTime getFreeOnboardingConsumedAt() {
    return freeOnboardingConsumedAt;
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }

  public OffsetDateTime getUpdatedAt() {
    return updatedAt;
  }

  private static void validateName(String name) {
    if (name == null || name.isBlank()) {
      throw new IllegalArgumentException("name must not be null or blank");
    }
    if (name.length() > 255) {
      throw new IllegalArgumentException("name must not exceed 255 characters");
    }
  }

  private static void validateDescription(String description) {
    if (description != null && description.length() > 2000) {
      throw new IllegalArgumentException("description must not exceed 2000 characters");
    }
  }
}
