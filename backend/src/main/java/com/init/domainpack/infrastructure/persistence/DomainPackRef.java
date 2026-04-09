package com.init.domainpack.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** domainpack bounded context의 domain_pack 읽기 전용 참조 모델 (cross-context 직접 의존 금지). */
@Entity
@Table(name = "domain_pack", schema = "pack")
public class DomainPackRef {

  @Id private Long id;

  @Column(name = "workspace_id", nullable = false, updatable = false)
  private Long workspaceId;

  protected DomainPackRef() {}

  public Long getId() {
    return id;
  }

  public Long getWorkspaceId() {
    return workspaceId;
  }
}
