package com.init.workflowruntime.application.command;

public record UpdateAssistantSlotCommand(Long sessionId, String slotCode, String value) {}
