package com.init.workflowruntime.application.dto;

public record AssistantNextAction(
    String type, String slotCode, String question, String message, String instruction) {}
