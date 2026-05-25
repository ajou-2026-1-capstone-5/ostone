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
@Table(name = "workflow_definition", schema = "pack")
public class WorkflowDefinition {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "domain_pack_version_id", nullable = false, updatable = false)
  private Long domainPackVersionId;

  @Column(name = "intent_definition_id", nullable = false, updatable = false)
  private Long intentDefinitionId;

  @Column(name = "is_primary", nullable = false)
  private Boolean isPrimary;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "route_condition_json", columnDefinition = "jsonb", nullable = false)
  private String routeConditionJson;

  @Column(name = "workflow_code", nullable = false)
  private String workflowCode;

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "description")
  private String description;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "graph_json", columnDefinition = "jsonb", nullable = false)
  private String graphJson;

  @Column(name = "initial_state")
  private String initialState;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "terminal_states_json", columnDefinition = "jsonb", nullable = false)
  private String terminalStatesJson;

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

  protected WorkflowDefinition() {}

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

  public static WorkflowDefinition create(
      Long domainPackVersionId,
      String workflowCode,
      String name,
      String description,
      String graphJson,
      String initialState,
      String terminalStatesJson,
      String evidenceJson,
      String metaJson,
      Long intentDefinitionId,
      Boolean isPrimary,
      String routeConditionJson) {
    Objects.requireNonNull(domainPackVersionId, "domainPackVersionId must not be null");
    Objects.requireNonNull(workflowCode, "workflowCode must not be null");
    Objects.requireNonNull(name, "name must not be null");
    Objects.requireNonNull(graphJson, "graphJson must not be null");
    Objects.requireNonNull(intentDefinitionId, "intentDefinitionId must not be null");

    WorkflowDefinition entity = new WorkflowDefinition();
    entity.domainPackVersionId = domainPackVersionId;
    entity.workflowCode = workflowCode;
    entity.name = name;
    entity.description = description;
    entity.graphJson = graphJson;
    entity.initialState = initialState;
    entity.terminalStatesJson = terminalStatesJson != null ? terminalStatesJson : "[]";
    entity.evidenceJson = evidenceJson != null ? evidenceJson : "[]";
    entity.metaJson = metaJson != null ? metaJson : "{}";
    entity.intentDefinitionId = intentDefinitionId;
    entity.isPrimary = isPrimary != null ? isPrimary : true;
    entity.routeConditionJson = routeConditionJson != null ? routeConditionJson : "{}";
    return entity;
  }

  public static WorkflowDefinition copyToVersion(
      WorkflowDefinition source, Long domainPackVersionId, Long newIntentDefinitionId) {
    return create(
        domainPackVersionId,
        source.workflowCode,
        source.name,
        source.description,
        source.graphJson,
        source.initialState,
        source.terminalStatesJson,
        source.evidenceJson,
        source.metaJson,
        newIntentDefinitionId,
        source.isPrimary,
        source.routeConditionJson);
  }

  public void updateGraph(
      String name,
      String description,
      String graphJson,
      String initialState,
      String terminalStatesJson) {
    Objects.requireNonNull(name, "name must not be null");
    Objects.requireNonNull(graphJson, "graphJson must not be null");
    Objects.requireNonNull(terminalStatesJson, "terminalStatesJson must not be null");
    if (name.isBlank()) {
      throw new IllegalArgumentException("name cannot be blank");
    }
    this.name = name;
    this.description = description;
    this.graphJson = graphJson;
    this.initialState = initialState;
    this.terminalStatesJson = terminalStatesJson;
  }

  public Long getId() {
    return id;
  }

  public Long getDomainPackVersionId() {
    return domainPackVersionId;
  }

  public Long getIntentDefinitionId() {
    return intentDefinitionId;
  }

  public Boolean getIsPrimary() {
    return isPrimary;
  }

  public String getRouteConditionJson() {
    return routeConditionJson;
  }

  public String getWorkflowCode() {
    return workflowCode;
  }

  public String getName() {
    return name;
  }

  public String getDescription() {
    return description;
  }

  public String getGraphJson() {
    return graphJson;
  }

  public String getInitialState() {
    return initialState;
  }

  public String getTerminalStatesJson() {
    return terminalStatesJson;
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
}
