package com.init.domainpack.infrastructure.persistence;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** domainpack bounded context의 workspace 읽기 전용 참조 모델 (cross-context 직접 의존 금지, U-005). */
@Entity
@Table(name = "workspace", schema = "app")
public class DomainPackWorkspaceRef {

  @Id private Long id;

  protected DomainPackWorkspaceRef() {}

  public Long getId() {
    return id;
  }
}
