package com.init.workflowruntime.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "simulation_golden_case", schema = "runtime")
public class SimulationGoldenCase {

  private static final int NAME_MAX_LENGTH = 255;

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "workspace_id", nullable = false)
  private Long workspaceId;

  @Column(name = "source_chat_session_id", nullable = false)
  private Long sourceChatSessionId;

  @Column(name = "source_domain_pack_version_id", nullable = false)
  private Long sourceDomainPackVersionId;

  @Column(nullable = false)
  private String name;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "input_messages_json", nullable = false, columnDefinition = "jsonb")
  private String inputMessagesJson;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "expected_json", nullable = false, columnDefinition = "jsonb")
  private String expectedJson;

  @Column(name = "created_by", nullable = false)
  private Long createdBy;

  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  protected SimulationGoldenCase() {
    // JPA constructor
  }

  public static SimulationGoldenCase create(
      Long workspaceId,
      Long sourceChatSessionId,
      Long sourceDomainPackVersionId,
      String name,
      String inputMessagesJson,
      String expectedJson,
      Long createdBy) {
    SimulationGoldenCase goldenCase = new SimulationGoldenCase();
    goldenCase.workspaceId = requireId(workspaceId, "workspaceId");
    goldenCase.sourceChatSessionId = requireId(sourceChatSessionId, "sourceChatSessionId");
    goldenCase.sourceDomainPackVersionId =
        requireId(sourceDomainPackVersionId, "sourceDomainPackVersionId");
    goldenCase.name = normalizeName(name);
    goldenCase.inputMessagesJson = normalizeJson(inputMessagesJson, "[]");
    goldenCase.expectedJson = normalizeJson(expectedJson, "{}");
    goldenCase.createdBy = requireId(createdBy, "createdBy");
    return goldenCase;
  }

  @PrePersist
  protected void onPersist() {
    OffsetDateTime now = OffsetDateTime.now();
    if (this.createdAt == null) {
      this.createdAt = now;
    }
    if (this.updatedAt == null) {
      this.updatedAt = now;
    }
  }

  @PreUpdate
  protected void onUpdate() {
    this.updatedAt = OffsetDateTime.now();
  }

  public Long getId() {
    return id;
  }

  public Long getWorkspaceId() {
    return workspaceId;
  }

  public Long getSourceChatSessionId() {
    return sourceChatSessionId;
  }

  public Long getSourceDomainPackVersionId() {
    return sourceDomainPackVersionId;
  }

  public String getName() {
    return name;
  }

  public String getInputMessagesJson() {
    return inputMessagesJson;
  }

  public String getExpectedJson() {
    return expectedJson;
  }

  public Long getCreatedBy() {
    return createdBy;
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }

  public OffsetDateTime getUpdatedAt() {
    return updatedAt;
  }

  private static Long requireId(Long value, String fieldName) {
    if (value == null) {
      throw new InvalidSimulationGoldenCaseException(fieldName + " must not be null");
    }
    return value;
  }

  private static String normalizeName(String value) {
    String normalized = value == null ? null : value.trim();
    if (normalized == null || normalized.isBlank()) {
      throw new InvalidSimulationGoldenCaseException("name must not be blank");
    }
    if (normalized.length() > NAME_MAX_LENGTH) {
      throw new InvalidSimulationGoldenCaseException("name must be at most " + NAME_MAX_LENGTH);
    }
    return normalized;
  }

  private static String normalizeJson(String value, String fallback) {
    return value == null || value.isBlank() ? fallback : value;
  }
}
