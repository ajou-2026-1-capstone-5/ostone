package com.init.pipelinejob.application;

public record TriggerDomainPackGenerationCommand(Long workspaceId, Long datasetId, Long userId) {}
