package com.init.domainpack.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.Objects;

@Entity
@Table(name = "domain_pack", schema = "pack")
public class DomainPack {

  public static final String STATUS_ACTIVE = "ACTIVE";

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "workspace_id", nullable = false, updatable = false)
  private Long workspaceId;

  @Column(name = "pack_key", nullable = false, updatable = false)
  private String packKey;

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "description")
  private String description;

  @Column(name = "status", nullable = false)
  private String status;

  @Column(name = "created_by")
  private Long createdBy;

  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  protected DomainPack() {}

  public static DomainPack create(
      Long workspaceId, String packKey, String name, String description, Long createdBy) {
    Objects.requireNonNull(workspaceId, "workspaceId must not be null");
    Objects.requireNonNull(packKey, "packKey must not be null");
    Objects.requireNonNull(name, "name must not be null");

    DomainPack domainPack = new DomainPack();
    domainPack.workspaceId = workspaceId;
    domainPack.packKey = packKey;
    domainPack.name = name;
    domainPack.description = description;
    domainPack.status = STATUS_ACTIVE;
    domainPack.createdBy = createdBy;
    return domainPack;
  }

  @PrePersist
  protected void onCreate() {
    OffsetDateTime now = OffsetDateTime.now();
    if (createdAt == null) {
      createdAt = now;
    }
    updatedAt = now;
  }

  @PreUpdate
  protected void onUpdate() {
    updatedAt = OffsetDateTime.now();
  }

  public Long getId() {
    return id;
  }

  public Long getWorkspaceId() {
    return workspaceId;
  }

  public String getPackKey() {
    return packKey;
  }

  public String getName() {
    return name;
  }

  public String getDescription() {
    return description;
  }

  public String getStatus() {
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
}
