package com.init.pipelinejob.application;

public record AddWorkflowDraftPortResult(
    Long domainPackVersionId,
    Long domainPackId,
    int addedSlotCount,
    int addedPolicyCount,
    int addedRiskCount,
    int addedWorkflowCount,
    int addedIntentSlotBindingCount,
    int addedIntentWorkflowBindingCount) {}
