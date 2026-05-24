package com.init.workflowruntime.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "workflow_execution_step", schema = "runtime")
public class WorkflowExecutionStep {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "workflow_execution_id", nullable = false)
  private Long workflowExecutionId;

  @Column(name = "seq_no", nullable = false)
  private int seqNo;

  @Column(name = "state_from", length = 100)
  private String stateFrom;

  @Column(name = "state_to", length = 100)
  private String stateTo;

  @Column(name = "action_type", nullable = false, length = 100)
  private String actionType;

  @Column(name = "reason_text", columnDefinition = "text")
  private String reasonText;

  @Column(name = "evidence_json", nullable = false)
  @JdbcTypeCode(SqlTypes.JSON)
  private String evidenceJson;

  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  protected WorkflowExecutionStep() {}

  public static WorkflowExecutionStep record(
      Long workflowExecutionId, int seqNo, String stateFrom, String stateTo, String actionType) {
    WorkflowExecutionStep step = new WorkflowExecutionStep();
    step.workflowExecutionId = workflowExecutionId;
    step.seqNo = seqNo;
    step.stateFrom = stateFrom;
    step.stateTo = stateTo;
    step.actionType = actionType;
    step.reasonText = null;
    step.evidenceJson = "[]";
    return step;
  }

  @PrePersist
  void onCreate() {
    if (createdAt == null) {
      createdAt = OffsetDateTime.now();
    }
  }

  public Long getId() {
    return id;
  }

  public Long getWorkflowExecutionId() {
    return workflowExecutionId;
  }

  public int getSeqNo() {
    return seqNo;
  }

  public String getStateFrom() {
    return stateFrom;
  }

  public String getStateTo() {
    return stateTo;
  }

  public String getActionType() {
    return actionType;
  }

  public String getReasonText() {
    return reasonText;
  }

  public String getEvidenceJson() {
    return evidenceJson;
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }
}
