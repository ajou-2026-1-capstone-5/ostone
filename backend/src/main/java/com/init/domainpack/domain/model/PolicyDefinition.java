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
@Table(name = "policy_definition", schema = "pack")
public class PolicyDefinition {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "domain_pack_version_id", nullable = false, updatable = false)
  private Long domainPackVersionId;

  @Column(name = "policy_code", nullable = false)
  private String policyCode;

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "description")
  private String description;

  @Column(name = "severity")
  private String severity;

  @Column(name = "condition_json", columnDefinition = "jsonb", nullable = false)
  private String conditionJson;

  @Column(name = "action_json", columnDefinition = "jsonb", nullable = false)
  private String actionJson;

  @Column(name = "evidence_json", columnDefinition = "jsonb", nullable = false)
  private String evidenceJson;

  @Column(name = "meta_json", columnDefinition = "jsonb", nullable = false)
  private String metaJson;

  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  protected PolicyDefinition() {}

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

  public static PolicyDefinition create(
      Long domainPackVersionId,
      String policyCode,
      String name,
      String description,
      String severity,
      String conditionJson,
      String actionJson,
      String evidenceJson,
      String metaJson) {
    Objects.requireNonNull(domainPackVersionId, "domainPackVersionId must not be null");
    Objects.requireNonNull(policyCode, "policyCode must not be null");
    Objects.requireNonNull(name, "name must not be null");

    PolicyDefinition entity = new PolicyDefinition();
    entity.domainPackVersionId = domainPackVersionId;
    entity.policyCode = policyCode;
    entity.name = name;
    entity.description = description;
    entity.severity = severity;
    entity.conditionJson = conditionJson != null ? conditionJson : "{}";
    entity.actionJson = actionJson != null ? actionJson : "{}";
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

  public String getPolicyCode() {
    return policyCode;
  }

  public String getName() {
    return name;
  }

  public String getDescription() {
    return description;
  }

  public String getSeverity() {
    return severity;
  }

  public String getConditionJson() {
    return conditionJson;
  }

  public String getActionJson() {
    return actionJson;
  }

  public String getEvidenceJson() {
    return evidenceJson;
  }

  public String getMetaJson() {
    return metaJson;
  }
}
