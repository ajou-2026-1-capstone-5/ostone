package com.init.workflowruntime.application.command;

public record GetOrCreateCurrentSessionCommand(Long workspaceId, Long userId) {}
