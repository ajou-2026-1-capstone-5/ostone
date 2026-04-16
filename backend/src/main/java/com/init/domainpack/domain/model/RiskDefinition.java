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
@Table(name = "risk_definition", schema = "pack")
public class RiskDefinition {

  public static final String STATUS_ACTIVE = "ACTIVE";
  public static final String STATUS_INACTIVE = "INACTIVE";

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "domain_pack_version_id", nullable = false, updatable = false)
  private Long domainPackVersionId;

  @Column(name = "risk_code", nullable = false)
  private String riskCode;

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "description")
  private String description;

  @Column(name = "risk_level", nullable = false)
  private String riskLevel;

  @Column(name = "trigger_condition_json", columnDefinition = "jsonb", nullable = false)
  private String triggerConditionJson;

  @Column(name = "handling_action_json", columnDefinition = "jsonb", nullable = false)
  private String handlingActionJson;

  @Column(name = "evidence_json", columnDefinition = "jsonb", nullable = false)
  private String evidenceJson;

  @Column(name = "meta_json", columnDefinition = "jsonb", nullable = false)
  private String metaJson;

  @Column(name = "status", nullable = false)
  private String status;

  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  protected RiskDefinition() {}

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

  public static RiskDefinition create(
      Long domainPackVersionId,
      String riskCode,
      String name,
      String description,
      String riskLevel,
      String triggerConditionJson,
      String handlingActionJson,
      String evidenceJson,
      String metaJson) {
    Objects.requireNonNull(domainPackVersionId, "domainPackVersionId must not be null");
    Objects.requireNonNull(riskCode, "riskCode must not be null");
    Objects.requireNonNull(riskLevel, "riskLevel must not be null");

    RiskDefinition entity = new RiskDefinition();
    entity.domainPackVersionId = domainPackVersionId;
    entity.riskCode = riskCode;
    entity.name = validateName(name);
    entity.description = description;
    entity.riskLevel = normalizeRiskLevel(riskLevel);
    entity.triggerConditionJson = triggerConditionJson != null ? triggerConditionJson : "{}";
    entity.handlingActionJson = handlingActionJson != null ? handlingActionJson : "{}";
    entity.evidenceJson = evidenceJson != null ? evidenceJson : "[]";
    entity.metaJson = metaJson != null ? metaJson : "{}";
    entity.status = STATUS_ACTIVE;
    return entity;
  }

  public void updateFields(
      String name,
      String description,
      String riskLevel,
      String triggerConditionJson,
      String handlingActionJson,
      String evidenceJson,
      String metaJson) {
    String validatedName = validateName(name);
    String normalizedRiskLevel = riskLevel != null ? normalizeRiskLevel(riskLevel) : this.riskLevel;

    this.name = validatedName;
    if (description != null) this.description = description;
    this.riskLevel = normalizedRiskLevel;
    if (triggerConditionJson != null) this.triggerConditionJson = triggerConditionJson;
    if (handlingActionJson != null) this.handlingActionJson = handlingActionJson;
    if (evidenceJson != null) this.evidenceJson = evidenceJson;
    if (metaJson != null) this.metaJson = metaJson;
  }

  public void changeStatus(String newStatus) {
    if (!STATUS_ACTIVE.equals(newStatus) && !STATUS_INACTIVE.equals(newStatus)) {
      throw new IllegalArgumentException("허용되지 않는 status 값입니다: " + newStatus);
    }
    this.status = newStatus;
  }

  private static String validateName(String name) {
    if (name == null) {
      throw new IllegalArgumentException("name은 필수 항목입니다.");
    }
    if (name.isBlank()) {
      throw new IllegalArgumentException("name은 비워둘 수 없습니다.");
    }
    return name;
  }

  private static String normalizeRiskLevel(String riskLevel) {
    try {
      return RiskLevel.normalize(riskLevel);
    } catch (IllegalArgumentException ex) {
      throw new IllegalArgumentException("Invalid riskLevel: " + riskLevel, ex);
    }
  }

  public Long getId() {
    return id;
  }

  public Long getDomainPackVersionId() {
    return domainPackVersionId;
  }

  public String getRiskCode() {
    return riskCode;
  }

  public String getName() {
    return name;
  }

  public String getDescription() {
    return description;
  }

  public String getRiskLevel() {
    return riskLevel;
  }

  public String getTriggerConditionJson() {
    return triggerConditionJson;
  }

  public String getHandlingActionJson() {
    return handlingActionJson;
  }

  public String getEvidenceJson() {
    return evidenceJson;
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
