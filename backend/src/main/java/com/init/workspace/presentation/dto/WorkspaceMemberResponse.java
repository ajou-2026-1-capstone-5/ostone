package com.init.workspace.presentation.dto;

import com.init.workspace.application.WorkspaceMemberListEntry;
import java.time.OffsetDateTime;

public record WorkspaceMemberResponse(
    Long memberId,
    Long userId,
    String name,
    String email,
    String workspaceRole,
    OffsetDateTime joinedAt,
    String accountStatus) {

  public static WorkspaceMemberResponse from(WorkspaceMemberListEntry entry) {
    return new WorkspaceMemberResponse(
        entry.memberId(),
        entry.userId(),
        entry.name(),
        entry.email(),
        entry.workspaceRole(),
        entry.joinedAt(),
        entry.accountStatus());
  }
}
