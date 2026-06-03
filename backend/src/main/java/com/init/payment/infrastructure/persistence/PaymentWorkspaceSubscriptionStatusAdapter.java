package com.init.payment.infrastructure.persistence;

import com.init.payment.domain.model.Subscription;
import com.init.payment.domain.repository.SubscriptionRepository;
import com.init.workspace.application.WorkspaceSubscriptionStatusPort;
import org.springframework.stereotype.Component;

@Component
public class PaymentWorkspaceSubscriptionStatusAdapter implements WorkspaceSubscriptionStatusPort {

  private final SubscriptionRepository subscriptionRepository;

  public PaymentWorkspaceSubscriptionStatusAdapter(SubscriptionRepository subscriptionRepository) {
    this.subscriptionRepository = subscriptionRepository;
  }

  @Override
  public boolean hasActiveSubscription(Long workspaceId) {
    return subscriptionRepository
        .findCurrentByWorkspaceId(workspaceId)
        .map(Subscription::isActive)
        .orElse(false);
  }
}
