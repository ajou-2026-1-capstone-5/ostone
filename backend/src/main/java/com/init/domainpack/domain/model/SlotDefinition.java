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
@Table(name = "slot_definition", schema = "pack")
public class SlotDefinition {

  public static final String STATUS_ACTIVE = "ACTIVE";
  public static final String STATUS_INACTIVE = "INACTIVE";

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

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "validation_rule_json", columnDefinition = "jsonb", nullable = false)
  private String validationRuleJson;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "default_value_json", columnDefinition = "jsonb")
  private String defaultValueJson;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "meta_json", columnDefinition = "jsonb", nullable = false)
  private String metaJson;

  @Column(name = "status", nullable = false)
  private String status;

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
    if (name.isBlank()) {
      throw new IllegalArgumentException("name은 비워둘 수 없습니다.");
    }
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
    entity.status = STATUS_ACTIVE;
    return entity;
  }

  public void updateFields(
      String name,
      String description,
      Boolean isSensitive,
      String validationRuleJson,
      String defaultValueJson,
      String metaJson) {
    Objects.requireNonNull(name, "name must not be null");
    if (name.isBlank()) {
      throw new IllegalArgumentException("name은 비워둘 수 없습니다.");
    }
    this.name = name;
    if (description != null) this.description = description;
    if (isSensitive != null) this.isSensitive = isSensitive;
    if (validationRuleJson != null) this.validationRuleJson = validationRuleJson;
    if (defaultValueJson != null) this.defaultValueJson = defaultValueJson;
    if (metaJson != null) this.metaJson = metaJson;
  }

  public void changeStatus(String newStatus) {
    if (!STATUS_ACTIVE.equals(newStatus) && !STATUS_INACTIVE.equals(newStatus)) {
      throw new IllegalArgumentException("허용되지 않는 status 값입니다: " + newStatus);
    }
    this.status = newStatus;
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

  public String getStatus() {
    return status;
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }

  public OffsetDateTime getUpdatedAt() {
    return updatedAt;
  }
}
