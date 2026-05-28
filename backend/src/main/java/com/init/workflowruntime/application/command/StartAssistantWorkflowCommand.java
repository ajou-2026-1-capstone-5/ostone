package com.init.workflowruntime.application.command;

public record StartAssistantWorkflowCommand(Long sessionId, String intentCode) {}
