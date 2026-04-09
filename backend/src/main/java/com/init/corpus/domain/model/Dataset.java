package com.init.corpus.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
@Table(name = "dataset", schema = "corpus")
public class Dataset {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "workspace_id", nullable = false)
  private Long workspaceId;

  @Column(name = "dataset_key", nullable = false, length = 100)
  private String datasetKey;

  @Column(nullable = false, length = 255)
  private String name;

  @Column(name = "source_type", nullable = false, length = 50)
  private String sourceType;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 50)
  private DatasetStatus status;

  @Enumerated(EnumType.STRING)
  @Column(name = "pii_redaction_status", nullable = false, length = 50)
  private PiiRedactionStatus piiRedactionStatus;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "meta_json", nullable = false)
  private String metaJson;

  @Column(name = "created_by")
  private Long createdBy;

  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  protected Dataset() {}

  public static Dataset create(
      Long workspaceId, String datasetKey, String name, String sourceType, Long createdBy) {
    Dataset dataset = new Dataset();
    dataset.workspaceId = workspaceId;
    dataset.datasetKey = datasetKey;
    dataset.name = name;
    dataset.sourceType = sourceType;
    dataset.status = DatasetStatus.READY;
    dataset.piiRedactionStatus = PiiRedactionStatus.PENDING;
    dataset.metaJson = "{}";
    dataset.createdBy = createdBy;
    return dataset;
  }

  @PrePersist
  protected void onPersist() {
    OffsetDateTime now = OffsetDateTime.now();
    this.createdAt = now;
    this.updatedAt = now;
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

  public String getDatasetKey() {
    return datasetKey;
  }

  public DatasetStatus getStatus() {
    return status;
  }

  public PiiRedactionStatus getPiiRedactionStatus() {
    return piiRedactionStatus;
  }

  public void updateMetaJson(String metaJson) {
    this.metaJson = metaJson;
  }
}
