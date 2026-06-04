package com.init.workflowruntime.application.dto;

public record WorkflowHumanInterventionMetricResponse(
    String stateName, long count, String description) {}
