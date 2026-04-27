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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "intent_definition", schema = "pack")
public class IntentDefinition {

  public static final String STATUS_DRAFT = "DRAFT";
  public static final String STATUS_ACTIVE = "ACTIVE";
  public static final String STATUS_PUBLISHED = "PUBLISHED";
  public static final String STATUS_REJECTED = "REJECTED";

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "domain_pack_version_id", nullable = false, updatable = false)
  private Long domainPackVersionId;

  @Column(name = "intent_code", nullable = false)
  private String intentCode;

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "description")
  private String description;

  @Column(name = "taxonomy_level", nullable = false)
  private Integer taxonomyLevel;

  @Column(name = "parent_intent_id")
  private Long parentIntentId;

  @Column(name = "status", nullable = false)
  private String status;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "source_cluster_ref", columnDefinition = "jsonb", nullable = false)
  private String sourceClusterRef;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "entry_condition_json", columnDefinition = "jsonb", nullable = false)
  private String entryConditionJson;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "evidence_json", columnDefinition = "jsonb", nullable = false)
  private String evidenceJson;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "meta_json", columnDefinition = "jsonb", nullable = false)
  private String metaJson;

  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  protected IntentDefinition() {}

  @PrePersist
  protected void onCreate() {
    OffsetDateTime now = OffsetDateTime.now();
    this.createdAt = now;
    this.updatedAt = now;
  }

  @PreUpdate
  protected void onUpdate() {
    this.updatedAt = OffsetDateTime.now();
  }

  public static IntentDefinition create(
      Long domainPackVersionId,
      String intentCode,
      String name,
      String description,
      Integer taxonomyLevel,
      String sourceClusterRef,
      String entryConditionJson,
      String evidenceJson,
      String metaJson) {
    Objects.requireNonNull(domainPackVersionId, "domainPackVersionId must not be null");
    Objects.requireNonNull(intentCode, "intentCode must not be null");
    Objects.requireNonNull(name, "name must not be null");

    IntentDefinition entity = new IntentDefinition();
    entity.domainPackVersionId = domainPackVersionId;
    entity.intentCode = intentCode;
    entity.name = name;
    entity.description = description;
    entity.taxonomyLevel = taxonomyLevel != null ? taxonomyLevel : 1;
    entity.status = "ACTIVE";
    entity.sourceClusterRef = sourceClusterRef != null ? sourceClusterRef : "{}";
    entity.entryConditionJson = entryConditionJson != null ? entryConditionJson : "{}";
    entity.evidenceJson = evidenceJson != null ? evidenceJson : "[]";
    entity.metaJson = metaJson != null ? metaJson : "{}";
    return entity;
  }

  public Long getId() {
    return id;
  }

  public Long getDomainPackVersionId() {
    return domainPackVersionId;
  }

  public String getIntentCode() {
    return intentCode;
  }

  public String getName() {
    return name;
  }

  public String getDescription() {
    return description;
  }

  public Integer getTaxonomyLevel() {
    return taxonomyLevel;
  }

  public Long getParentIntentId() {
    return parentIntentId;
  }

  public void assignParent(Long parentIntentId) {
    if (this.id != null && parentIntentId != null && Objects.equals(this.id, parentIntentId)) {
      throw new IllegalArgumentException("Intent cannot be its own parent: id=" + this.id);
    }
    this.parentIntentId = parentIntentId;
  }

  public String getStatus() {
    return status;
  }

  public void changeStatus(String newStatus) {
    if (!STATUS_PUBLISHED.equals(newStatus) && !STATUS_REJECTED.equals(newStatus)) {
      throw new IllegalArgumentException("허용되지 않는 status 값입니다: " + newStatus);
    }
    if (!STATUS_DRAFT.equals(this.status) && !STATUS_ACTIVE.equals(this.status)) {
      throw new IllegalStateException("DRAFT 또는 ACTIVE 상태에서만 status를 변경할 수 있습니다. 현재: " + this.status);
    }
    this.status = newStatus;
  }

  public String getSourceClusterRef() {
    return sourceClusterRef;
  }

  public String getEntryConditionJson() {
    return entryConditionJson;
  }

  public String getEvidenceJson() {
    return evidenceJson;
  }

  public String getMetaJson() {
    return metaJson;
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }

  public OffsetDateTime getUpdatedAt() {
    return updatedAt;
  }

  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (!(o instanceof IntentDefinition that)) {
      return false;
    }
    return id != null && id.equals(that.id);
  }

  @Override
  public int hashCode() {
    return getClass().hashCode();
  }
}
