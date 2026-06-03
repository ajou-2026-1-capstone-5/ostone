package com.init.workspace.application;

import java.time.OffsetDateTime;

public record AdminCustomerMemberEntryResult(
    Long memberId,
    Long userId,
    String name,
    String email,
    String workspaceRole,
    String accountStatus,
    OffsetDateTime joinedAt) {}
