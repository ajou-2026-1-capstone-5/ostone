package com.init.workspace.application;

public interface WorkspaceDashboardQueryPort {

  WorkspaceDashboardHealthResult findKnowledgePackHealth(Long workspaceId);
}
