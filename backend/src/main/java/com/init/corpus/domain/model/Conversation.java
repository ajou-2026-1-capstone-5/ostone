package com.init.corpus.domain.model;

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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "conversation", schema = "corpus")
public class Conversation {

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
    Conversation conv = new Conversation();
    conv.datasetId = datasetId;
    conv.externalCaseId = externalCaseId;
    conv.channel = channel;
    conv.languageCode = languageCode != null ? languageCode : "ko";
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
    this.createdAt = OffsetDateTime.now();
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
}
