package com.init.workflowruntime.infrastructure.persistence;

import com.init.workflowruntime.application.UserChatSessionConcurrencyGuard;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Component;

@Component
public class PostgreSqlUserChatSessionConcurrencyGuard implements UserChatSessionConcurrencyGuard {

  private final EntityManager entityManager;

  public PostgreSqlUserChatSessionConcurrencyGuard(EntityManager entityManager) {
    this.entityManager = entityManager;
  }

  @Override
  public void lockCurrentSession(Long workspaceId, Long userId) {
    String lockText = "user-chat-current-session:workspace:" + workspaceId + ":user:" + userId;
    entityManager
        .createNativeQuery("select pg_advisory_xact_lock(hashtextextended(:lockText, 0))")
        .setParameter("lockText", lockText)
        .getSingleResult();
  }
}
