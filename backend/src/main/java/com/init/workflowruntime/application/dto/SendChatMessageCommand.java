package com.init.workflowruntime.application.dto;

public record SendChatMessageCommand(
    Long sessionId, String content, Long userId, String senderRole) {}
