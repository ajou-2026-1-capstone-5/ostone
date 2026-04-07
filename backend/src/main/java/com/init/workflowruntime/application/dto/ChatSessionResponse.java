package com.init.workflowruntime.application.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.OffsetDateTime;
import com.init.workflowruntime.domain.ChatSession;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ChatSessionResponse {
  private Long id;
  private String status;
  private String channel;
  private String metaJson;
  private OffsetDateTime startedAt;

  public static ChatSessionResponse from(ChatSession session) {
    ChatSessionResponse resp = new ChatSessionResponse();
    resp.id = session.getId();
    resp.status = session.getStatus();
    resp.channel = session.getChannel();
    resp.metaJson = session.getMetaJson();
    resp.startedAt = session.getStartedAt();
    return resp;
  }

  public Long getId() { return id; }
  public String getStatus() { return status; }
  public String getChannel() { return channel; }
  public String getMetaJson() { return metaJson; }
  public OffsetDateTime getStartedAt() { return startedAt; }

  // Setters
  public void setId(Long id) { this.id = id; }
  public void setStatus(String status) { this.status = status; }
  public void setChannel(String channel) { this.channel = channel; }
  public void setMetaJson(String metaJson) { this.metaJson = metaJson; }
  public void setStartedAt(OffsetDateTime startedAt) { this.startedAt = startedAt; }
}
