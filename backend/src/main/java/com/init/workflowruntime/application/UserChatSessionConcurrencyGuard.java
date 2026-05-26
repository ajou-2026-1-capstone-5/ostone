package com.init.workflowruntime.application;

public interface UserChatSessionConcurrencyGuard {

  void lockCurrentSession(Long workspaceId, Long userId);
}
