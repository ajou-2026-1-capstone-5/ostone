package com.init.chatdemo.presentation.dto;

public record DemoDecisionLogResponse(
    String id,
    int step,
    String messageId,
    String eventType,
    String stateFrom,
    String stateTo,
    String decision,
    double confidence,
    String reason) {}
