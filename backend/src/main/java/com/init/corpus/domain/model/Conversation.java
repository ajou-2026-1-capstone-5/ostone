package com.init.corpus.domain.model;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.Basic;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Objects;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "conversation", schema = "corpus")
public class Conversation {

  private static final ObjectMapper JSON_MAPPER = new ObjectMapper();

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "dataset_id", nullable = false)
  private Long datasetId;

  @Column(name = "external_case_id", length = 255)
  private String externalCaseId;

  @Column(length = 50)
  private String channel;

  @Column(name = "language_code", nullable = false, length = 20)
  private String languageCode;

  @Column(name = "started_at")
  private OffsetDateTime startedAt;

  @Column(name = "ended_at")
  private OffsetDateTime endedAt;

  @Column(name = "turn_count", nullable = false)
  private int turnCount;

  @Lob
  @Basic(fetch = FetchType.LAZY)
  @Column(name = "customer_text", columnDefinition = "text")
  private String customerText;

  @Lob
  @Basic(fetch = FetchType.LAZY)
  @Column(name = "full_text", columnDefinition = "text")
  private String fullText;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "meta_json", nullable = false)
  private String metaJson;

  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  protected Conversation() {}

  public static Conversation create(
      Long datasetId,
      String externalCaseId,
      String channel,
      String languageCode,
      OffsetDateTime startedAt,
      OffsetDateTime endedAt,
      String customerText,
      String fullText,
      int turnCount) {
    Objects.requireNonNull(datasetId, "datasetId must not be null");
    if (turnCount < 0) {
      throw new IllegalArgumentException("turnCount must be >= 0");
    }
    if (startedAt != null && endedAt != null && endedAt.isBefore(startedAt)) {
      throw new IllegalArgumentException("endedAt must be greater than or equal to startedAt");
    }
    Conversation conv = new Conversation();
    conv.datasetId = datasetId;
    if (externalCaseId != null && externalCaseId.length() > 255) {
      throw new IllegalArgumentException("externalCaseId must not exceed 255 characters");
    }
    conv.externalCaseId = externalCaseId;
    if (channel != null && channel.length() > 50) {
      throw new IllegalArgumentException("channel must not exceed 50 characters");
    }
    conv.channel = channel;
    String resolvedLanguageCode =
        (languageCode == null || languageCode.isBlank()) ? "ko" : languageCode;
    if (resolvedLanguageCode.length() > 20) {
      throw new IllegalArgumentException("languageCode must not exceed 20 characters");
    }
    conv.languageCode = resolvedLanguageCode;
    conv.startedAt = startedAt;
    conv.endedAt = endedAt;
    conv.customerText = customerText;
    conv.fullText = fullText;
    conv.turnCount = turnCount;
    conv.metaJson = "{}";
    return conv;
  }

  @PrePersist
  protected void onPersist() {
    this.createdAt = OffsetDateTime.now(ZoneOffset.UTC);
  }

  public Long getId() {
    return id;
  }

  public Long getDatasetId() {
    return datasetId;
  }

  public int getTurnCount() {
    return turnCount;
  }

  public void updateMetaJson(String metaJson) {
    Objects.requireNonNull(metaJson, "metaJson must not be null");
    if (metaJson.isBlank()) {
      throw new IllegalArgumentException("metaJson must not be blank");
    }
    try {
      JSON_MAPPER.readTree(metaJson);
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException(
          "metaJson is not valid JSON: " + e.getOriginalMessage(), e);
    }
    this.metaJson = metaJson;
  }
}
