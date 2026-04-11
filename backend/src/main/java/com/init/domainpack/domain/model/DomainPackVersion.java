package com.init.domainpack.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.OffsetDateTime;
import java.util.Objects;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "domain_pack_version", schema = "pack")
public class DomainPackVersion {

  public static final String STATUS_DRAFT = "DRAFT";
  public static final String STATUS_PUBLISHED = "PUBLISHED";

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "domain_pack_id", nullable = false, updatable = false)
  private Long domainPackId;

  @Column(name = "version_no", nullable = false)
  private Integer versionNo;

  @Column(name = "lifecycle_status", nullable = false)
  private String lifecycleStatus;

  @Column(name = "source_pipeline_job_id")
  private Long sourcePipelineJobId;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "summary_json", columnDefinition = "jsonb", nullable = false)
  private String summaryJson;

  @Column(name = "published_at")
  private OffsetDateTime publishedAt;

  @Column(name = "created_by")
  private Long createdBy;

  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  @Version private Long version;

  protected DomainPackVersion() {}

  @PrePersist
  protected void onCreate() {
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
    if (this.updatedAt == null) {
      this.updatedAt = OffsetDateTime.now();
    }
  }

  /**
   * 새로운 DRAFT 버전을 생성한다.
   *
   * @param domainPackId 도메인 팩 ID
   * @param versionNo 버전 번호
   * @param createdBy 생성자 ID
   * @param sourcePipelineJobId 파이프라인 Job ID (nullable)
   * @param summaryJson 요약 JSON
   * @return 새로운 DRAFT 상태의 DomainPackVersion
   */
  public static DomainPackVersion createDraft(
      Long domainPackId,
      Integer versionNo,
      Long createdBy,
      Long sourcePipelineJobId,
      String summaryJson) {
    Objects.requireNonNull(domainPackId, "domainPackId must not be null");
    Objects.requireNonNull(versionNo, "versionNo must not be null");

    DomainPackVersion v = new DomainPackVersion();
    v.domainPackId = domainPackId;
    v.versionNo = versionNo;
    v.lifecycleStatus = STATUS_DRAFT;
    v.createdBy = createdBy;
    v.sourcePipelineJobId = sourcePipelineJobId;
    v.summaryJson = summaryJson != null ? summaryJson : "{}";
    return v;
  }

  /**
   * PUBLISHED가 아닌 모든 상태에서 PUBLISHED로 전이한다 (U-001 Confirmed).
   *
   * @param now 활성화 시각
   * @throws IllegalStateException 이미 PUBLISHED 상태인 경우
   */
  public void activate(OffsetDateTime now) {
    Objects.requireNonNull(now, "publishedAt (now) must not be null");
    if (STATUS_PUBLISHED.equals(this.lifecycleStatus)) {
      throw new IllegalStateException("Domain pack version is already published");
    }
    this.lifecycleStatus = STATUS_PUBLISHED;
    this.publishedAt = now;
    this.updatedAt = now;
  }

  public Long getId() {
    return id;
  }

  public Long getDomainPackId() {
    return domainPackId;
  }

  public Integer getVersionNo() {
    return versionNo;
  }

  public String getLifecycleStatus() {
    return lifecycleStatus;
  }

  public Long getSourcePipelineJobId() {
    return sourcePipelineJobId;
  }

  public String getSummaryJson() {
    return summaryJson;
  }

  public OffsetDateTime getPublishedAt() {
    return publishedAt;
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
}
