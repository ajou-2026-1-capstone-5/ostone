package com.init.workflowruntime.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.Objects;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "workflow_execution", schema = "runtime")
public class WorkflowExecution {

  public static final String STATUS_RUNNING = "RUNNING";

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "chat_session_id", nullable = false)
  private Long chatSessionId;

  @Column(name = "workflow_definition_id")
  private Long workflowDefinitionId;

  @Column(name = "intent_definition_id")
  private Long intentDefinitionId;

  @Column(nullable = false)
  private String status;

  @Column(name = "current_state")
  private String currentState;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "slot_values_json", columnDefinition = "jsonb", nullable = false)
  private String slotValuesJson;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "policy_snapshot_json", columnDefinition = "jsonb", nullable = false)
  private String policySnapshotJson;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "risk_snapshot_json", columnDefinition = "jsonb", nullable = false)
  private String riskSnapshotJson;

  @Column(name = "started_at", nullable = false, updatable = false)
  private OffsetDateTime startedAt;

  @Column(name = "finished_at")
  private OffsetDateTime finishedAt;

  protected WorkflowExecution() {}

  public static WorkflowExecution create(Long chatSessionId) {
    Objects.requireNonNull(chatSessionId, "chatSessionId must not be null");

    WorkflowExecution execution = new WorkflowExecution();
    execution.chatSessionId = chatSessionId;
    execution.status = STATUS_RUNNING;
    execution.slotValuesJson = "{}";
    execution.policySnapshotJson = "{}";
    execution.riskSnapshotJson = "{}";
    return execution;
  }

  @PrePersist
  protected void onPersist() {
    if (this.startedAt == null) {
      this.startedAt = OffsetDateTime.now();
    }
  }

  public Long getId() {
    return id;
  }

  public Long getChatSessionId() {
    return chatSessionId;
  }

  public Long getWorkflowDefinitionId() {
    return workflowDefinitionId;
  }

  public Long getIntentDefinitionId() {
    return intentDefinitionId;
  }

  public String getStatus() {
    return status;
  }

  public String getCurrentState() {
    return currentState;
  }

  public String getSlotValuesJson() {
    return slotValuesJson;
  }

  public String getPolicySnapshotJson() {
    return policySnapshotJson;
  }

  public String getRiskSnapshotJson() {
    return riskSnapshotJson;
  }

  public OffsetDateTime getStartedAt() {
    return startedAt;
  }

  public OffsetDateTime getFinishedAt() {
    return finishedAt;
  }

  public void replaceSlotValuesJson(String slotValuesJson) {
    this.slotValuesJson = slotValuesJson != null ? slotValuesJson : "{}";
  }

  public void assignIntentWorkflow(
      Long intentDefinitionId, Long workflowDefinitionId, String currentState) {
    Objects.requireNonNull(intentDefinitionId, "intentDefinitionId must not be null");
    Objects.requireNonNull(workflowDefinitionId, "workflowDefinitionId must not be null");
    Objects.requireNonNull(currentState, "currentState must not be null");

    this.intentDefinitionId = intentDefinitionId;
    this.workflowDefinitionId = workflowDefinitionId;
    this.currentState = currentState;
    this.status = STATUS_RUNNING;
  }
}
