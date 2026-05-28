package com.init.workflowruntime.application.command;

public record IntentClassificationCommand(
    Long sessionId, String latestUserMessage, String conversationContext) {}
