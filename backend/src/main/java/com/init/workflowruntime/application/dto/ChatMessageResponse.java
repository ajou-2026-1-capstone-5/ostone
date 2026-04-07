package com.init.workflowruntime.application.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.init.workflowruntime.domain.ChatMessage;
import java.time.OffsetDateTime;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ChatMessageResponse {
  private Long id;
  private Integer seqNo;
  private String senderRole;
  private String messageType;
  private String content;
  private OffsetDateTime createdAt;

  public static ChatMessageResponse from(ChatMessage message) {
    ChatMessageResponse resp = new ChatMessageResponse();
    resp.id = message.getId();
    resp.seqNo = message.getSeqNo();
    resp.senderRole = message.getSenderRole();
    resp.messageType = message.getMessageType();
    resp.content = message.getContent();
    resp.createdAt = message.getCreatedAt();
    return resp;
  }

  // Getters
  public Long getId() { return id; }
  public Integer getSeqNo() { return seqNo; }
  public String getSenderRole() { return senderRole; }
  public String getMessageType() { return messageType; }
  public String getContent() { return content; }
  public OffsetDateTime getCreatedAt() { return createdAt; }

  // Setters
  public void setId(Long id) { this.id = id; }
  public void setSeqNo(Integer seqNo) { this.seqNo = seqNo; }
  public void setSenderRole(String senderRole) { this.senderRole = senderRole; }
  public void setMessageType(String messageType) { this.messageType = messageType; }
  public void setContent(String content) { this.content = content; }
  public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
