package com.init.workspace.application;

public interface WorkspaceSubscriptionStatusPort {

  boolean hasActiveSubscription(Long workspaceId);
}
