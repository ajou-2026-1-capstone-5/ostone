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
@Table(name = "slot_definition", schema = "pack")
public class SlotDefinition {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "domain_pack_version_id", nullable = false, updatable = false)
  private Long domainPackVersionId;

  @Column(name = "slot_code", nullable = false)
  private String slotCode;

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "description")
  private String description;

  @Column(name = "data_type", nullable = false)
  private String dataType;

  @Column(name = "is_sensitive", nullable = false)
  private Boolean isSensitive;

  @Column(name = "validation_rule_json", columnDefinition = "jsonb", nullable = false)
  private String validationRuleJson;

  @Column(name = "default_value_json", columnDefinition = "jsonb")
  private String defaultValueJson;

  @Column(name = "meta_json", columnDefinition = "jsonb", nullable = false)
  private String metaJson;

  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  protected SlotDefinition() {}

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

  public static SlotDefinition create(
      Long domainPackVersionId,
      String slotCode,
      String name,
      String description,
      String dataType,
      Boolean isSensitive,
      String validationRuleJson,
      String defaultValueJson,
      String metaJson) {
    Objects.requireNonNull(domainPackVersionId, "domainPackVersionId must not be null");
    Objects.requireNonNull(slotCode, "slotCode must not be null");
    Objects.requireNonNull(name, "name must not be null");
    Objects.requireNonNull(dataType, "dataType must not be null");

    SlotDefinition entity = new SlotDefinition();
    entity.domainPackVersionId = domainPackVersionId;
    entity.slotCode = slotCode;
    entity.name = name;
    entity.description = description;
    entity.dataType = dataType;
    entity.isSensitive = isSensitive != null ? isSensitive : false;
    entity.validationRuleJson = validationRuleJson != null ? validationRuleJson : "{}";
    entity.defaultValueJson = defaultValueJson;
    entity.metaJson = metaJson != null ? metaJson : "{}";
    return entity;
  }

  public Long getId() {
    return id;
  }

  public Long getDomainPackVersionId() {
    return domainPackVersionId;
  }

  public String getSlotCode() {
    return slotCode;
  }

  public String getName() {
    return name;
  }

  public String getDescription() {
    return description;
  }

  public String getDataType() {
    return dataType;
  }

  public Boolean getIsSensitive() {
    return isSensitive;
  }

  public String getValidationRuleJson() {
    return validationRuleJson;
  }

  public String getDefaultValueJson() {
    return defaultValueJson;
  }

  public String getMetaJson() {
    return metaJson;
  }
}
