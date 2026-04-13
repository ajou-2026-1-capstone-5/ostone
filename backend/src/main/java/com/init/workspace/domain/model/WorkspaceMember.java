package com.init.workspace.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

@Entity
@Table(name = "workspace_member", schema = "app")
public class WorkspaceMember {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "workspace_id", nullable = false)
  private Long workspaceId;

  @Column(name = "user_id", nullable = false)
  private Long userId;

  @Enumerated(EnumType.STRING)
  @Column(name = "member_role", nullable = false)
  private WorkspaceMemberRole memberRole;

  @Column(name = "joined_at", nullable = false, updatable = false)
  private OffsetDateTime joinedAt;

  protected WorkspaceMember() {}

  public static WorkspaceMember create(Long workspaceId, Long userId, WorkspaceMemberRole memberRole) {
    if (workspaceId == null) {
      throw new IllegalArgumentException("workspaceId must not be null");
    }
    if (userId == null) {
      throw new IllegalArgumentException("userId must not be null");
    }
    if (memberRole == null) {
      throw new IllegalArgumentException("memberRole must not be null");
    }

    WorkspaceMember member = new WorkspaceMember();
    member.workspaceId = workspaceId;
    member.userId = userId;
    member.memberRole = memberRole;
    return member;
  }

  @PrePersist
  protected void onPersist() {
    this.joinedAt = OffsetDateTime.now();
  }

  public Long getId() {
    return id;
  }

  public Long getWorkspaceId() {
    return workspaceId;
  }

  public Long getUserId() {
    return userId;
  }

  public WorkspaceMemberRole getMemberRole() {
    return memberRole;
  }

  public OffsetDateTime getJoinedAt() {
    return joinedAt;
  }
}
