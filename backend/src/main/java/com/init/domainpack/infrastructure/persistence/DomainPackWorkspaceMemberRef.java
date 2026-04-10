package com.init.domainpack.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * domainpack bounded context의 workspace_member 읽기 전용 참조 모델.
 *
 * <p>corpus의 {@code WorkspaceMemberRef}는 {@code member_role} 컬럼을 매핑하지 않으므로, 역할 필터링에 필요한 별도 read
 * model을 정의한다 (spec Additional Notes 참조).
 */
@Entity
@Table(name = "workspace_member", schema = "app")
public class DomainPackWorkspaceMemberRef {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "workspace_id", nullable = false)
  private Long workspaceId;

  @Column(name = "user_id", nullable = false)
  private Long userId;

  @Column(name = "member_role", nullable = false)
  private String memberRole;

  protected DomainPackWorkspaceMemberRef() {}
}
