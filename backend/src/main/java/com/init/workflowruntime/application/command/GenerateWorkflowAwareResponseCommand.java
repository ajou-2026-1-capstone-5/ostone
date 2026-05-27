package com.init.workflowruntime.application.command;

public record GenerateWorkflowAwareResponseCommand(
    Long sessionId, String conversationContext, String userMessage) {}
