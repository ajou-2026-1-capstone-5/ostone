package com.init.workflowruntime.application.dto;

public record WorkflowHitMetricResponse(
    String name, long count, String stateName, String description) {}
