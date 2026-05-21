package com.init.workflowruntime.domain.event;

public record SessionAssignedEvent(Long sessionId, Long counselorId) {}
