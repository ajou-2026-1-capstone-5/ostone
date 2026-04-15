package com.init.pipelinejob.infrastructure.persistence;

import com.init.pipelinejob.domain.model.WebhookReceipt;
import com.init.pipelinejob.domain.repository.WebhookReceiptRepository;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaWebhookReceiptRepository
    extends JpaRepository<WebhookReceipt, Long>, WebhookReceiptRepository {

  Optional<WebhookReceipt> findByExternalEventId(String externalEventId);
}
