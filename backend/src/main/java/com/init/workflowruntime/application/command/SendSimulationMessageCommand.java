package com.init.workflowruntime.application.command;

public record SendSimulationMessageCommand(
    Long workspaceId, Long sessionId, Long userId, String content) {}
