package com.init.corpus.domain.model;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.Objects;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "dataset", schema = "corpus")
public class Dataset {

  private static final ObjectMapper JSON_MAPPER = new ObjectMapper();

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
    Dataset dataset = newDataset(workspaceId, datasetKey, name, sourceType, createdBy);
    dataset.status = DatasetStatus.READY;
    return dataset;
  }

  /**
   * presigned 업로드 흐름에서 사용하는 팩토리. 클라이언트가 S3로 직접 업로드를 마치고 complete를 호출하기 전까지 데이터셋은 {@code UPLOADING}
   * 상태로 머문다.
   */
  public static Dataset createUploading(
      Long workspaceId, String datasetKey, String name, String sourceType, Long createdBy) {
    Dataset dataset = newDataset(workspaceId, datasetKey, name, sourceType, createdBy);
    dataset.status = DatasetStatus.UPLOADING;
    return dataset;
  }

  private static Dataset newDataset(
      Long workspaceId, String datasetKey, String name, String sourceType, Long createdBy) {
    Dataset dataset = new Dataset();
    dataset.workspaceId = workspaceId;
    dataset.datasetKey = datasetKey;
    dataset.name = name;
    dataset.sourceType = sourceType;
    dataset.piiRedactionStatus = PiiRedactionStatus.PENDING;
    dataset.metaJson = "{}";
    dataset.createdBy = createdBy;
    return dataset;
  }

  /**
   * 업로드 완료 후 ML 파이프라인 처리 단계로 전이한다. 이미 {@code PROCESSING} 이상이면 멱등하게 무시되어 중복 트리거를 막는다.
   *
   * @return 이번 호출로 실제 {@code PROCESSING} 전이가 일어났으면 true, 이미 처리 중이거나 완료 상태면 false
   */
  public boolean markProcessing() {
    if (status == DatasetStatus.UPLOADING) {
      this.status = DatasetStatus.PROCESSING;
      return true;
    }
    return false;
  }

  public boolean markIngestionTriggerFailed() {
    if (status == DatasetStatus.UPLOADING || status == DatasetStatus.PROCESSING) {
      this.status = DatasetStatus.ERROR;
      return true;
    }
    return false;
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

  public String getMetaJson() {
    return metaJson;
  }

  public Long getCreatedBy() {
    return createdBy;
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
