package com.init.workflowruntime.application.dto;

public record WorkflowTransitionMetricResponse(String stateFrom, String stateTo, long passCount) {}
