package com.init.pipelinejob.domain.repository;

import com.init.pipelinejob.domain.model.WebhookReceipt;
import java.util.Optional;

public interface WebhookReceiptRepository {

  Optional<WebhookReceipt> findByExternalEventId(String externalEventId);

  WebhookReceipt saveAndFlush(WebhookReceipt webhookReceipt);
}
