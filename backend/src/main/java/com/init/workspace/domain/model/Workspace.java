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
