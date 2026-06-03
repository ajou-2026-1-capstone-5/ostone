package com.init.workspace.presentation.dto;

import com.init.workspace.application.AdminCustomerMemberEntryResult;
import java.time.OffsetDateTime;

public record AdminCustomerMemberEntryResponse(
    Long memberId,
    Long userId,
    String name,
    String email,
    String workspaceRole,
    String accountStatus,
    OffsetDateTime joinedAt) {

  static AdminCustomerMemberEntryResponse from(AdminCustomerMemberEntryResult result) {
    return new AdminCustomerMemberEntryResponse(
        result.memberId(),
        result.userId(),
        result.name(),
        result.email(),
        result.workspaceRole(),
        result.accountStatus(),
        result.joinedAt());
  }
}
