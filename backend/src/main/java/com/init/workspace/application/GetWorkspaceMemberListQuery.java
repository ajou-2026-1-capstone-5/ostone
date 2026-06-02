package com.init.workspace.application;

public record GetWorkspaceMemberListQuery(
    Long workspaceId, Long requesterId, String search, String role) {}
