package com.init.workspace.domain.model;

public enum WorkspaceMemberRole {
  OWNER,
  ADMIN,
  REVIEWER,
  OPERATOR;

  public boolean canManageMembers() {
    return this == OWNER || this == ADMIN;
  }
}
