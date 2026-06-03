package com.init.payment.domain.repository;

import com.init.payment.domain.model.WebhookEvent;
import java.util.Optional;

public interface WebhookEventRepository {

  WebhookEvent save(WebhookEvent webhookEvent);

  Optional<WebhookEvent> findByTransmissionId(String transmissionId);
}
