package com.init.workflowruntime.application.dto;

import com.init.workflowruntime.domain.event.ConsultationQueueEventType;
import java.time.OffsetDateTime;

public class ConsultationQueueEventResponse {
  private ConsultationQueueEventType type;
  private ChatSessionResponse session;
  private OffsetDateTime occurredAt;

  public ConsultationQueueEventResponse() {}

  public ConsultationQueueEventResponse(
      ConsultationQueueEventType type, ChatSessionResponse session, OffsetDateTime occurredAt) {
    this.type = type;
    this.session = session;
    this.occurredAt = occurredAt;
  }

  public ConsultationQueueEventType getType() {
    return type;
  }

  public void setType(ConsultationQueueEventType type) {
    this.type = type;
  }

  public ChatSessionResponse getSession() {
    return session;
  }

  public void setSession(ChatSessionResponse session) {
    this.session = session;
  }

  public OffsetDateTime getOccurredAt() {
    return occurredAt;
  }

  public void setOccurredAt(OffsetDateTime occurredAt) {
    this.occurredAt = occurredAt;
  }
}
