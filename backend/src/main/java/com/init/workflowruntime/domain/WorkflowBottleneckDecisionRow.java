package com.init.workflowruntime.domain;

import java.time.OffsetDateTime;

public record WorkflowBottleneckDecisionRow(
    Long executionId,
    String stateName,
    String selectedAction,
    String missingSlotsJson,
    String policyHitsJson,
    String riskHitsJson,
    OffsetDateTime createdAt) {}
