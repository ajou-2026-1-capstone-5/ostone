package com.init.pipelinejob.application;

public interface DomainPackGenerationConcurrencyGuard {

  void lockTriggerCreation(Long workspaceId, Long datasetId);
}
