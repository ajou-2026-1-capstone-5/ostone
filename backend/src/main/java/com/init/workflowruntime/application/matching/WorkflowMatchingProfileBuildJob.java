package com.init.workflowruntime.application.matching;

public record WorkflowMatchingProfileBuildJob(
    Long id, Long domainPackVersionId, String triggerType, String profileVersion) {}
