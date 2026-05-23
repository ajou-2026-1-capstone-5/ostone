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
@Table(name = "decision_log", schema = "runtime")
public class DecisionLog {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "workflow_execution_id", nullable = false)
  private Long workflowExecutionId;

  @Column(name = "step_seq_no", nullable = false)
  private int stepSeqNo;

  @Column(name = "decision_type", nullable = false, length = 100)
  private String decisionType;

  @Column(name = "intent_definition_id")
  private Long intentDefinitionId;

  @Column(name = "state_name", length = 100)
  private String stateName;

  @Column(name = "confidence_score")
  private Double confidenceScore;

  @Column(name = "selected_action", length = 100)
  private String selectedAction;

  @Column(name = "missing_slots_json", nullable = false)
  @JdbcTypeCode(SqlTypes.JSON)
  private String missingSlotsJson;

  @Column(name = "policy_hits_json", nullable = false)
  @JdbcTypeCode(SqlTypes.JSON)
  private String policyHitsJson;

  @Column(name = "risk_hits_json", nullable = false)
  @JdbcTypeCode(SqlTypes.JSON)
  private String riskHitsJson;

  @Column(name = "evidence_json", nullable = false)
  @JdbcTypeCode(SqlTypes.JSON)
  private String evidenceJson;

  @Column(name = "payload_json", nullable = false)
  @JdbcTypeCode(SqlTypes.JSON)
  private String payloadJson;

  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  protected DecisionLog() {}

  public static DecisionLog record(
      Long workflowExecutionId,
      int stepSeqNo,
      String decisionType,
      Long intentDefinitionId,
      String stateName,
      Double confidenceScore,
      String selectedAction,
      String missingSlotsJson,
      String payloadJson) {
    DecisionLog log = new DecisionLog();
    log.workflowExecutionId = workflowExecutionId;
    log.stepSeqNo = stepSeqNo;
    log.decisionType = decisionType;
    log.intentDefinitionId = intentDefinitionId;
    log.stateName = stateName;
    log.confidenceScore = confidenceScore;
    log.selectedAction = selectedAction;
    log.missingSlotsJson = missingSlotsJson != null ? missingSlotsJson : "[]";
    log.policyHitsJson = "[]";
    log.riskHitsJson = "[]";
    log.evidenceJson = "[]";
    log.payloadJson = payloadJson != null ? payloadJson : "{}";
    return log;
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

  public int getStepSeqNo() {
    return stepSeqNo;
  }

  public String getDecisionType() {
    return decisionType;
  }

  public Long getIntentDefinitionId() {
    return intentDefinitionId;
  }

  public String getStateName() {
    return stateName;
  }

  public Double getConfidenceScore() {
    return confidenceScore;
  }

  public String getSelectedAction() {
    return selectedAction;
  }

  public String getMissingSlotsJson() {
    return missingSlotsJson;
  }

  public String getPolicyHitsJson() {
    return policyHitsJson;
  }

  public String getRiskHitsJson() {
    return riskHitsJson;
  }

  public String getEvidenceJson() {
    return evidenceJson;
  }

  public String getPayloadJson() {
    return payloadJson;
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }
}
