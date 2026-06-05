package com.init.workflowruntime.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "simulation_golden_case_replay_result", schema = "runtime")
public class SimulationGoldenCaseReplayResult {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "workspace_id", nullable = false)
  private Long workspaceId;

  @Column(name = "golden_case_id", nullable = false)
  private Long goldenCaseId;

  @Column(name = "domain_pack_version_id", nullable = false)
  private Long domainPackVersionId;

  @Column(name = "replay_chat_session_id", nullable = false)
  private Long replayChatSessionId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private SimulationGoldenCaseReplayStatus status;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "expected_json", nullable = false, columnDefinition = "jsonb")
  private String expectedJson;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "actual_json", nullable = false, columnDefinition = "jsonb")
  private String actualJson;

  @Column(name = "failure_summary", columnDefinition = "TEXT")
  private String failureSummary;

  @Column(name = "created_by", nullable = false)
  private Long createdBy;

  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  protected SimulationGoldenCaseReplayResult() {
    // JPA constructor
  }

  public static SimulationGoldenCaseReplayResult record(
      Long workspaceId,
      Long goldenCaseId,
      Long domainPackVersionId,
      Long replayChatSessionId,
      SimulationGoldenCaseReplayStatus status,
      String expectedJson,
      String actualJson,
      String failureSummary,
      Long createdBy) {
    SimulationGoldenCaseReplayResult result = new SimulationGoldenCaseReplayResult();
    result.workspaceId = requireId(workspaceId, "workspaceId");
    result.goldenCaseId = requireId(goldenCaseId, "goldenCaseId");
    result.domainPackVersionId = requireId(domainPackVersionId, "domainPackVersionId");
    result.replayChatSessionId = requireId(replayChatSessionId, "replayChatSessionId");
    result.status = requireStatus(status);
    result.expectedJson = normalizeJson(expectedJson, "{}");
    result.actualJson = normalizeJson(actualJson, "{}");
    result.failureSummary = normalizeOptional(failureSummary);
    result.createdBy = requireId(createdBy, "createdBy");
    return result;
  }

  @PrePersist
  protected void onPersist() {
    if (this.createdAt == null) {
      this.createdAt = OffsetDateTime.now();
    }
  }

  public Long getId() {
    return id;
  }

  public Long getWorkspaceId() {
    return workspaceId;
  }

  public Long getGoldenCaseId() {
    return goldenCaseId;
  }

  public Long getDomainPackVersionId() {
    return domainPackVersionId;
  }

  public Long getReplayChatSessionId() {
    return replayChatSessionId;
  }

  public SimulationGoldenCaseReplayStatus getStatus() {
    return status;
  }

  public String getExpectedJson() {
    return expectedJson;
  }

  public String getActualJson() {
    return actualJson;
  }

  public String getFailureSummary() {
    return failureSummary;
  }

  public Long getCreatedBy() {
    return createdBy;
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }

  private static Long requireId(Long value, String fieldName) {
    if (value == null) {
      throw new InvalidSimulationGoldenCaseException(fieldName + " must not be null");
    }
    return value;
  }

  private static SimulationGoldenCaseReplayStatus requireStatus(
      SimulationGoldenCaseReplayStatus status) {
    if (status == null) {
      throw new InvalidSimulationGoldenCaseException("status must not be null");
    }
    return status;
  }

  private static String normalizeJson(String value, String fallback) {
    return value == null || value.isBlank() ? fallback : value;
  }

  private static String normalizeOptional(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }
}
