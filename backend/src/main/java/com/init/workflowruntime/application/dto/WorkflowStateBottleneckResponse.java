package com.init.workflowruntime.application.dto;

public record WorkflowStateBottleneckResponse(
    String stateName, long metricValue, long executionCount, String description) {}
