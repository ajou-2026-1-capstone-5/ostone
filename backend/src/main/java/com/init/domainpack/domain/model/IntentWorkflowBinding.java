package com.init.domainpack.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.Objects;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "intent_workflow_binding", schema = "pack")
public class IntentWorkflowBinding {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "intent_definition_id", nullable = false)
  private Long intentDefinitionId;

  @Column(name = "workflow_definition_id", nullable = false)
  private Long workflowDefinitionId;

  @Column(name = "is_primary", nullable = false)
  private Boolean isPrimary;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "route_condition_json", columnDefinition = "jsonb", nullable = false)
  private String routeConditionJson;

  protected IntentWorkflowBinding() {}

  public static IntentWorkflowBinding create(
      Long intentDefinitionId,
      Long workflowDefinitionId,
      Boolean isPrimary,
      String routeConditionJson) {
    Objects.requireNonNull(intentDefinitionId, "intentDefinitionId must not be null");
    Objects.requireNonNull(workflowDefinitionId, "workflowDefinitionId must not be null");

    IntentWorkflowBinding entity = new IntentWorkflowBinding();
    entity.intentDefinitionId = intentDefinitionId;
    entity.workflowDefinitionId = workflowDefinitionId;
    entity.isPrimary = isPrimary != null ? isPrimary : true;
    entity.routeConditionJson = routeConditionJson != null ? routeConditionJson : "{}";
    return entity;
  }

  public Long getId() {
    return id;
  }

  public Long getIntentDefinitionId() {
    return intentDefinitionId;
  }

  public Long getWorkflowDefinitionId() {
    return workflowDefinitionId;
  }

  public Boolean getIsPrimary() {
    return isPrimary;
  }

  public String getRouteConditionJson() {
    return routeConditionJson;
  }
}
