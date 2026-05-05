package com.init.pipelinejob.application;

public interface DatasetOwnershipPort {

  boolean existsByIdAndWorkspaceId(Long datasetId, Long workspaceId);
}
