package com.init.shared.application.quota;

public interface WorkspaceQuotaValidator {

  void assertDatasetUploadAllowed(Long workspaceId);

  void assertPipelineRunAllowed(Long workspaceId);
}
