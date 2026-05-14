package com.init.corpus.application.port;

public interface IngestionTriggerPort {

  void trigger(Long workspaceId, Long datasetId, String objectKey);
}
