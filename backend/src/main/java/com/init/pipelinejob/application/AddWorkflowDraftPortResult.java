package com.init.pipelinejob.application;

public record AddWorkflowDraftPortResult(
    int addedSlotCount,
    int addedPolicyCount,
    int addedRiskCount,
    int addedWorkflowCount,
    int addedIntentSlotBindingCount) {}
