package com.init.domainpack.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.OffsetDateTime;
import java.util.Objects;

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

  @Column(name = "published_at")
  private OffsetDateTime publishedAt;

  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  @Version private Long version;

  protected DomainPackVersion() {}

  @PreUpdate
  protected void onUpdate() {
    this.updatedAt = OffsetDateTime.now();
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

  public OffsetDateTime getPublishedAt() {
    return publishedAt;
  }

  public OffsetDateTime getUpdatedAt() {
    return updatedAt;
  }
}
