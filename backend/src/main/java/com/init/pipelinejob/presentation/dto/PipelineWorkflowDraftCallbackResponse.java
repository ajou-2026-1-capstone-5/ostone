package com.init.pipelinejob.presentation.dto;

public record PipelineWorkflowDraftCallbackResponse(
    String status,
    String externalEventId,
    Long domainPackId,
    Long domainPackVersionId,
    Integer addedSlotCount,
    Integer addedPolicyCount,
    Integer addedRiskCount,
    Integer addedWorkflowCount,
    Integer addedIntentSlotBindingCount,
    Integer addedIntentWorkflowBindingCount,
    Long sourcePipelineJobId) {}
