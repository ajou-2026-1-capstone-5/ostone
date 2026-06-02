package com.init.workspace.application;

import java.time.OffsetDateTime;

public record WorkspaceMemberListEntry(
    Long memberId,
    Long userId,
    String name,
    String email,
    String workspaceRole,
    OffsetDateTime joinedAt,
    String accountStatus) {}
