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
@Table(name = "intent_definition", schema = "pack")
public class IntentDefinition {

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

  @Column(name = "source_cluster_ref", columnDefinition = "jsonb", nullable = false)
  private String sourceClusterRef;

  @Column(name = "entry_condition_json", columnDefinition = "jsonb", nullable = false)
  private String entryConditionJson;

  @Column(name = "evidence_json", columnDefinition = "jsonb", nullable = false)
  private String evidenceJson;

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
    if (Objects.equals(this.id, parentIntentId)) {
      throw new IllegalArgumentException("Intent cannot be its own parent: id=" + this.id);
    }
    this.parentIntentId = parentIntentId;
  }

  public String getStatus() {
    return status;
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
