package com.init.workflowruntime.domain.event;

public record ConsultationQueueChangedEvent(
    Long workspaceId, Long sessionId, ConsultationQueueEventType type) {}
