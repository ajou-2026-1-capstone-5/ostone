package com.init.payment.infrastructure.persistence;

import com.init.payment.domain.model.WebhookEvent;
import com.init.payment.domain.repository.WebhookEventRepository;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaWebhookEventRepository
    extends JpaRepository<WebhookEvent, Long>, WebhookEventRepository {

  @Override
  Optional<WebhookEvent> findByTransmissionId(String transmissionId);
}
