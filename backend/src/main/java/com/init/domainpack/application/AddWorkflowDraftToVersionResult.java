package com.init.domainpack.application;

public record AddWorkflowDraftToVersionResult(
    Long domainPackVersionId,
    Long domainPackId,
    int addedSlotCount,
    int addedPolicyCount,
    int addedRiskCount,
    int addedWorkflowCount,
    int addedIntentSlotBindingCount,
    int addedIntentWorkflowBindingCount) {}
