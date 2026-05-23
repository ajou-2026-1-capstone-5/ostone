package com.init.workflowruntime.event;

public record ChatMessageReceivedEvent(Long sessionId, String content, Long userId) {}
