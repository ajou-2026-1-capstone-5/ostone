package com.init.pipelinejob.application;

public interface IngestionDatasetStatusPort {

  void markIngestionTriggerFailed(Long workspaceId, Long datasetId);
}
