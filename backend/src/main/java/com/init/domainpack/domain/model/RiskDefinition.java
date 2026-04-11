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
    Objects.requireNonNull(name, "name must not be null");
    Objects.requireNonNull(riskLevel, "riskLevel must not be null");

    RiskDefinition entity = new RiskDefinition();
    entity.domainPackVersionId = domainPackVersionId;
    entity.riskCode = riskCode;
    entity.name = name;
    entity.description = description;
    entity.riskLevel = riskLevel;
    entity.triggerConditionJson = triggerConditionJson != null ? triggerConditionJson : "{}";
    entity.handlingActionJson = handlingActionJson != null ? handlingActionJson : "{}";
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
}
